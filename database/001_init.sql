-- =============================================================================
--  Asistente Ejecutivo "Voice-First" — Esquema inicial
--  Motor: PostgreSQL 15+ / Supabase
--  Ejecutar completo en: Supabase → SQL Editor  (o `psql -f 001_init.sql`)
--  Es idempotente: se puede volver a correr sin romper datos existentes.
-- =============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- similitud de texto (búsqueda semántica "difusa")
create extension if not exists unaccent;   -- "reunión" == "reunion"

-- Zona horaria de negocio (UTC-3, sin horario de verano)
create or replace function app_tz() returns text
language sql immutable as $$ select 'America/Argentina/Buenos_Aires'::text $$;

-- unaccent() no es IMMUTABLE; este wrapper permite usarlo en índices.
create or replace function f_unaccent(text) returns text
language sql immutable parallel safe strict as
$$ select public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- =============================================================================
--  1. TABLAS
-- =============================================================================

create table if not exists public.tasks (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (length(trim(title)) > 0),
  description      text,
  category         varchar(32) not null default '#Personal'
                   check (category in ('#Constructora','#AgenciaViajes','#ConsultoraIA','#Estudio','#Personal')),
  priority         varchar(8)  not null default 'media'
                   check (priority in ('alta','media','baja')),
  status           varchar(16) not null default 'pendiente'
                   check (status in ('pendiente','en_progreso','completada','cancelada')),
  due_date         timestamptz,
  reminder_at      timestamptz,
  reminder_sent    boolean not null default false,
  gcal_event_id    text unique,
  -- Campos de soporte (no pedidos explícitamente, pero necesarios para el sistema)
  completed_at     timestamptz,
  source           varchar(16) not null default 'telegram'
                   check (source in ('telegram','pwa','gcal','system')),
  last_modified_by varchar(16) not null default 'system'
                   check (last_modified_by in ('telegram','pwa','gcal','system')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.tasks.last_modified_by is
  'Quién hizo el último cambio. Evita bucles en la sincronización con Google Calendar.';

-- Historial corto de conversación con el agente (memoria de contexto)
create table if not exists public.agent_messages (
  id         bigint generated always as identity primary key,
  chat_id    bigint not null,
  role       varchar(8) not null check (role in ('user','model')),
  content    text not null,
  created_at timestamptz not null default now()
);

-- Usuarios habilitados para la PWA (uso personal: tu email)
create table if not exists public.app_users (
  email text primary key
);

-- =============================================================================
--  2. ÍNDICES
-- =============================================================================

create index if not exists tasks_reminder_idx  on public.tasks (reminder_at)
  where status = 'pendiente' and reminder_sent = false;
create index if not exists tasks_due_idx       on public.tasks (due_date);
create index if not exists tasks_status_idx    on public.tasks (status);
create index if not exists tasks_category_idx  on public.tasks (category);
create index if not exists tasks_title_trgm    on public.tasks
  using gin (f_unaccent(lower(title)) gin_trgm_ops);
create index if not exists agent_messages_chat_idx on public.agent_messages (chat_id, created_at desc);

-- =============================================================================
--  3. TRIGGERS
-- =============================================================================

create or replace function trg_tasks_before_write() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();

  -- completed_at automático
  if new.status = 'completada' and (tg_op = 'INSERT' or old.status is distinct from 'completada') then
    new.completed_at := now();
  elsif new.status <> 'completada' then
    new.completed_at := null;
  end if;

  -- Si cambia la hora del recordatorio, se "rearma" automáticamente
  if tg_op = 'UPDATE' and new.reminder_at is distinct from old.reminder_at then
    new.reminder_sent := false;
  end if;

  return new;
end $$;

drop trigger if exists tasks_before_write on public.tasks;
create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function trg_tasks_before_write();

-- =============================================================================
--  4. FUNCIONES DE NEGOCIO (RPC)  — las invoca n8n vía  POST /rest/v1/rpc/<fn>
--     Todas devuelven JSONB para que el agente Gemini las lea directamente.
-- =============================================================================

create or replace function priority_rank(p text) returns int
language sql immutable as $$ select case p when 'alta' then 1 when 'media' then 2 else 3 end $$;

-- Representación compacta de una tarea para el LLM / Telegram
create or replace function task_json(t public.tasks) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'description', t.description,
    'category', t.category,
    'priority', t.priority,
    'status', t.status,
    'due_date', t.due_date,
    'due_local', to_char(t.due_date at time zone app_tz(), 'Dy DD/MM HH24:MI'),
    'reminder_at', t.reminder_at,
    'completed_at', t.completed_at,
    'gcal_event_id', t.gcal_event_id
  )
$$;

-- 4.1 Crear tarea --------------------------------------------------------------
create or replace function fn_create_task(
  p_title        text,
  p_description  text        default null,
  p_category     text        default '#Personal',
  p_priority     text        default 'media',
  p_due_date     timestamptz default null,
  p_reminder_at  timestamptz default null,
  p_source       text        default 'telegram'
) returns jsonb
language plpgsql as $$
declare
  v_reminder timestamptz := p_reminder_at;
  t public.tasks;
begin
  -- Recordatorio por defecto: 15 min antes del vencimiento (o al vencimiento si ya es muy tarde)
  if v_reminder is null and p_due_date is not null then
    v_reminder := greatest(p_due_date - interval '15 minutes', least(now(), p_due_date));
  end if;

  insert into public.tasks (title, description, category, priority, due_date, reminder_at, source, last_modified_by)
  values (trim(p_title), p_description,
          coalesce(nullif(p_category,''), '#Personal'),
          coalesce(nullif(p_priority,''), 'media'),
          p_due_date, v_reminder, p_source, p_source)
  returning * into t;

  return jsonb_build_object('status','created','task', task_json(t));
end $$;

-- 4.2 Búsqueda semántica difusa (trigram + unaccent) ---------------------------
create or replace function fn_find_tasks(
  p_query    text,
  p_statuses text[] default array['pendiente','en_progreso'],
  p_limit    int    default 5
) returns jsonb
language sql stable as $$
  with q as (select f_unaccent(lower(trim(p_query))) as q)
  select coalesce(jsonb_agg(r order by (r->>'score')::numeric desc), '[]'::jsonb)
  from (
    select task_json(t) || jsonb_build_object(
             'score', round(greatest(
                        similarity(f_unaccent(lower(t.title)), q.q),
                        word_similarity(q.q, f_unaccent(lower(t.title)))
                      )::numeric, 3)) as r
    from public.tasks t, q
    where t.status = any(p_statuses)
      and (  f_unaccent(lower(t.title)) % q.q
          or q.q <% f_unaccent(lower(t.title))
          or f_unaccent(lower(t.title)) like '%' || q.q || '%')
    order by greatest(similarity(f_unaccent(lower(t.title)), q.q),
                      word_similarity(q.q, f_unaccent(lower(t.title)))) desc
    limit p_limit
  ) s
$$;

-- 4.3 Listar tareas por rango -------------------------------------------------
--  p_range: 'today' | 'tomorrow' | 'week' | 'overdue' | 'all_pending' | 'custom'
create or replace function fn_list_tasks(
  p_range    text        default 'today',
  p_from     timestamptz default null,
  p_to       timestamptz default null,
  p_category text        default null,
  p_statuses text[]      default array['pendiente','en_progreso']
) returns jsonb
language plpgsql stable as $$
declare
  v_today date := (now() at time zone app_tz())::date;
  v_from timestamptz;
  v_to   timestamptz;
begin
  case p_range
    when 'today'    then v_from := v_today::timestamp at time zone app_tz();
                         v_to   := (v_today + 1)::timestamp at time zone app_tz();
    when 'tomorrow' then v_from := (v_today + 1)::timestamp at time zone app_tz();
                         v_to   := (v_today + 2)::timestamp at time zone app_tz();
    when 'week'     then v_from := v_today::timestamp at time zone app_tz();
                         v_to   := (v_today + 7)::timestamp at time zone app_tz();
    when 'overdue'  then v_from := '-infinity'; v_to := now();
    when 'custom'   then v_from := coalesce(p_from, '-infinity'); v_to := coalesce(p_to, 'infinity');
    else                 v_from := '-infinity'; v_to := 'infinity';  -- all_pending
  end case;

  return coalesce((
    select jsonb_agg(task_json(t) order by t.due_date nulls last, priority_rank(t.priority))
    from public.tasks t
    where t.status = any(p_statuses)
      and (p_category is null or t.category = p_category)
      and (p_range = 'all_pending' or (t.due_date >= v_from and t.due_date < v_to))
  ), '[]'::jsonb);
end $$;

-- 4.4 Completar tarea (por id o por coincidencia semántica) --------------------
create or replace function fn_complete_task(
  p_task_id uuid default null,
  p_query   text default null,
  p_by      text default 'telegram'
) returns jsonb
language plpgsql as $$
declare
  v_matches jsonb;
  v_id uuid := p_task_id;
  t public.tasks;
begin
  if v_id is null then
    if coalesce(trim(p_query),'') = '' then
      return jsonb_build_object('status','error','message','Falta task_id o query');
    end if;
    v_matches := fn_find_tasks(p_query, array['pendiente','en_progreso'], 3);
    if jsonb_array_length(v_matches) = 0 then
      return jsonb_build_object('status','not_found','query',p_query);
    end if;
    -- Auto-confirmar solo si el mejor resultado es claro
    if (v_matches->0->>'score')::numeric >= 0.45
       and (jsonb_array_length(v_matches) = 1
            or (v_matches->0->>'score')::numeric - (v_matches->1->>'score')::numeric >= 0.15) then
      v_id := (v_matches->0->>'id')::uuid;
    else
      return jsonb_build_object('status','ambiguous','candidates',v_matches);
    end if;
  end if;

  update public.tasks
     set status = 'completada', last_modified_by = p_by
   where id = v_id
  returning * into t;

  if not found then
    return jsonb_build_object('status','not_found','task_id',v_id);
  end if;
  return jsonb_build_object('status','completed','task',task_json(t));
end $$;

-- 4.5 Actualizar campos arbitrarios --------------------------------------------
create or replace function fn_update_task(
  p_task_id uuid,
  p_patch   jsonb,
  p_by      text default 'telegram'
) returns jsonb
language plpgsql as $$
declare t public.tasks;
begin
  update public.tasks set
    title       = case when p_patch ? 'title'       then p_patch->>'title'                     else title end,
    description = case when p_patch ? 'description' then p_patch->>'description'               else description end,
    category    = case when p_patch ? 'category'    then p_patch->>'category'                  else category end,
    priority    = case when p_patch ? 'priority'    then p_patch->>'priority'                  else priority end,
    status      = case when p_patch ? 'status'      then p_patch->>'status'                    else status end,
    due_date    = case when p_patch ? 'due_date'    then (p_patch->>'due_date')::timestamptz   else due_date end,
    reminder_at = case when p_patch ? 'reminder_at' then (p_patch->>'reminder_at')::timestamptz else reminder_at end,
    last_modified_by = p_by
  where id = p_task_id
  returning * into t;

  if not found then return jsonb_build_object('status','not_found','task_id',p_task_id); end if;
  return jsonb_build_object('status','updated','task',task_json(t));
end $$;

-- 4.6 Reprogramar (con opción "en cadena") -------------------------------------
--  Mueve una tarea. Si p_cascade = true, desplaza el mismo delta a todas las
--  tareas pendientes posteriores del MISMO día local (ej: "me atrasé 1 hora").
create or replace function fn_reschedule_task(
  p_task_id       uuid,
  p_new_due       timestamptz default null,
  p_shift_minutes int         default null,
  p_cascade       boolean     default false,
  p_by            text        default 'telegram'
) returns jsonb
language plpgsql as $$
declare
  v_old   public.tasks;
  v_delta interval;
  v_day   date;
  v_moved jsonb;
begin
  select * into v_old from public.tasks where id = p_task_id for update;
  if not found then return jsonb_build_object('status','not_found','task_id',p_task_id); end if;

  if p_new_due is not null then
    v_delta := p_new_due - coalesce(v_old.due_date, now());
  elsif p_shift_minutes is not null then
    v_delta := make_interval(mins => p_shift_minutes);
  else
    return jsonb_build_object('status','error','message','Indicar p_new_due o p_shift_minutes');
  end if;

  v_day := (coalesce(v_old.due_date, now()) at time zone app_tz())::date;

  with moved as (
    update public.tasks t set
      due_date    = coalesce(t.due_date, now()) + v_delta,
      reminder_at = case when t.reminder_at is null then null
                         else greatest(t.reminder_at + v_delta, now()) end,
      last_modified_by = p_by
    where t.id = p_task_id
       or (p_cascade
           and v_old.due_date is not null
           and t.status in ('pendiente','en_progreso')
           and t.due_date > v_old.due_date
           and (t.due_date at time zone app_tz())::date = v_day)
    returning t.*
  )
  select jsonb_agg(task_json(m) order by m.due_date) into v_moved from moved m;

  return jsonb_build_object('status','rescheduled',
                            'shift_minutes', round(extract(epoch from v_delta)/60),
                            'tasks', coalesce(v_moved,'[]'::jsonb));
end $$;

-- 4.7 Acciones rápidas (botones de Telegram y gestos de la PWA) ----------------
--  p_action: 'done' | 'snooze_1h' | 'tomorrow' | 'start' | 'cancel'
create or replace function fn_task_action(
  p_task_id uuid,
  p_action  text,
  p_by      text default 'telegram'
) returns jsonb
language plpgsql as $$
declare t public.tasks;
begin
  update public.tasks set
    status = case p_action
               when 'done'   then 'completada'
               when 'start'  then 'en_progreso'
               when 'cancel' then 'cancelada'
               else status end,
    reminder_at = case p_action
               when 'snooze_1h' then now() + interval '1 hour'
               when 'tomorrow'  then coalesce(reminder_at, now()) + interval '1 day'
               else reminder_at end,
    due_date = case p_action
               when 'tomorrow' then
                 coalesce(due_date + interval '1 day',
                          ((now() at time zone app_tz())::date + 1 + time '09:00') at time zone app_tz())
               else due_date end,
    last_modified_by = p_by
  where id = p_task_id
  returning * into t;

  if not found then return jsonb_build_object('status','not_found','task_id',p_task_id); end if;
  return jsonb_build_object('status','ok','action',p_action,'task',task_json(t));
end $$;

-- 4.8 Reclamar recordatorios vencidos (atómico: evita envíos duplicados) -------
create or replace function fn_claim_due_reminders(p_limit int default 50)
returns jsonb
language sql as $$
  with due as (
    select id from public.tasks
    where status = 'pendiente'
      and reminder_sent = false
      and reminder_at <= now()
    order by reminder_at
    limit p_limit
    for update skip locked
  ), upd as (
    update public.tasks t
       set reminder_sent = true, last_modified_by = 'system'
      from due where t.id = due.id
    returning t.*
  )
  select coalesce(jsonb_agg(task_json(u) order by priority_rank(u.priority), u.reminder_at), '[]'::jsonb) from upd u
$$;

-- 4.9 Datos para el briefing matutino -----------------------------------------
create or replace function fn_briefing() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'date_local', to_char(now() at time zone app_tz(), 'TMDay DD/MM/YYYY'),
    'today',   fn_list_tasks('today'),
    'overdue', coalesce((
        select jsonb_agg(task_json(t) order by t.due_date)
        from public.tasks t
        where t.status in ('pendiente','en_progreso')
          and t.due_date < ((now() at time zone app_tz())::date)::timestamp at time zone app_tz()
      ), '[]'::jsonb),
    'completed_yesterday', (
        select count(*) from public.tasks
        where status = 'completada'
          and completed_at >= (((now() at time zone app_tz())::date - 1)::timestamp at time zone app_tz())
          and completed_at <  (((now() at time zone app_tz())::date)::timestamp at time zone app_tz()))
  )
$$;

-- 4.10 Contexto para el agente (tareas abiertas próximas, compacto) -----------
create or replace function fn_agent_context(p_chat_id bigint default null) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'now_local', to_char(now() at time zone app_tz(), 'YYYY-MM-DD"T"HH24:MI:SS') || '-03:00',
    'weekday',   to_char(now() at time zone app_tz(), 'TMDay'),
    'open_tasks', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', t.id, 'title', t.title, 'category', t.category,
                 'priority', t.priority, 'status', t.status,
                 'due_local', to_char(t.due_date at time zone app_tz(), 'YYYY-MM-DD HH24:MI'))
               order by t.due_date nulls last)
        from (select * from public.tasks
              where status in ('pendiente','en_progreso')
              order by due_date nulls last limit 60) t
      ), '[]'::jsonb),
    'history', coalesce((
        select jsonb_agg(jsonb_build_object('role', m.role, 'content', m.content) order by m.created_at)
        from (select * from public.agent_messages
              where chat_id = p_chat_id
                and created_at > now() - interval '6 hours'
              order by created_at desc limit 10) m
      ), '[]'::jsonb)
  )
$$;

create or replace function fn_log_message(p_chat_id bigint, p_role text, p_content text)
returns void language sql as $$
  insert into public.agent_messages (chat_id, role, content) values (p_chat_id, p_role, left(p_content, 4000));
  delete from public.agent_messages where created_at < now() - interval '7 days';
$$;

-- 4.11 Sincronización Google Calendar ----------------------------------------
-- Guardar el event_id sin disparar otra sincronización (last_modified_by = system)
create or replace function fn_mark_gcal_synced(p_task_id uuid, p_event_id text)
returns jsonb language sql as $$
  update public.tasks set gcal_event_id = p_event_id, last_modified_by = 'system'
  where id = p_task_id
  returning jsonb_build_object('status','ok','task_id',id,'gcal_event_id',gcal_event_id)
$$;

drop function if exists fn_upsert_task_from_gcal(text,text,text,timestamptz,boolean);

-- Upsert desde un evento de Google Calendar. No-op si nada cambió (corta bucles).
create or replace function fn_upsert_task_from_gcal(
  p_event_id    text,
  p_title       text,
  p_description text        default null,
  p_start       timestamptz default null,
  p_cancelled   boolean     default false,
  p_task_id     uuid        default null   -- extendedProperties.private.taskId (eventos creados por nosotros)
) returns jsonb
language plpgsql as $$
declare t public.tasks;
begin
  select * into t from public.tasks
   where gcal_event_id = p_event_id
      or (p_task_id is not null and id = p_task_id)
   order by (gcal_event_id = p_event_id) desc nulls last
   limit 1;

  if not found then
    if p_cancelled then return jsonb_build_object('status','ignored'); end if;
    insert into public.tasks (title, description, due_date, reminder_at, gcal_event_id, source, last_modified_by)
    values (p_title, p_description, p_start,
            case when p_start is not null then greatest(p_start - interval '15 minutes', now()) end,
            p_event_id, 'gcal', 'gcal')
    returning * into t;
    return jsonb_build_object('status','created','task',task_json(t));
  end if;

  if p_cancelled then
    if t.status = 'cancelada' then return jsonb_build_object('status','unchanged'); end if;
    update public.tasks set status = 'cancelada', last_modified_by = 'gcal' where id = t.id returning * into t;
    return jsonb_build_object('status','cancelled','task',task_json(t));
  end if;

  if t.gcal_event_id is null then
    update public.tasks set gcal_event_id = p_event_id, last_modified_by = 'system' where id = t.id
    returning * into t;
  end if;

  if t.title is not distinct from p_title
     and coalesce(t.description,'') = coalesce(p_description,'')
     and (   (t.due_date is null and p_start is null)
          or abs(extract(epoch from (t.due_date - p_start))) < 60) then
    return jsonb_build_object('status','unchanged');
  end if;

  update public.tasks set
    title = p_title,
    description = nullif(p_description,''),
    reminder_at = case when t.due_date is distinct from p_start and p_start is not null
                       then greatest(p_start - (coalesce(t.due_date - t.reminder_at, interval '15 minutes')), now())
                       else reminder_at end,
    due_date = p_start,
    last_modified_by = 'gcal'
  where id = t.id
  returning * into t;
  return jsonb_build_object('status','updated','task',task_json(t));
end $$;

-- =============================================================================
--  5. SEGURIDAD (RLS)
--     - n8n usa la service_role key → ignora RLS.
--     - La PWA usa la anon key + sesión de Supabase Auth → solo emails en app_users.
-- =============================================================================

alter table public.tasks          enable row level security;
alter table public.agent_messages enable row level security;
alter table public.app_users      enable row level security;

create or replace function is_app_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_users where email = (auth.jwt() ->> 'email'))
$$;

drop policy if exists tasks_owner_all on public.tasks;
create policy tasks_owner_all on public.tasks
  for all to authenticated
  using (is_app_user()) with check (is_app_user());

-- Las funciones que modifican datos solo las ejecuta n8n (service_role).
-- La PWA únicamente usa fn_task_action (SECURITY INVOKER → respeta RLS).
do $$
declare f text;
begin
  foreach f in array array[
    'fn_create_task(text,text,text,text,timestamptz,timestamptz,text)',
    'fn_find_tasks(text,text[],int)',
    'fn_list_tasks(text,timestamptz,timestamptz,text,text[])',
    'fn_complete_task(uuid,text,text)',
    'fn_update_task(uuid,jsonb,text)',
    'fn_reschedule_task(uuid,timestamptz,int,boolean,text)',
    'fn_claim_due_reminders(int)',
    'fn_briefing()',
    'fn_agent_context(bigint)',
    'fn_log_message(bigint,text,text)',
    'fn_mark_gcal_synced(uuid,text)',
    'fn_upsert_task_from_gcal(text,text,text,timestamptz,boolean,uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%s from anon, authenticated', f);
      execute format('grant execute on function public.%s to service_role', f);
    end if;
  end loop;
end $$;

-- =============================================================================
--  6. REALTIME (Supabase)
-- =============================================================================
alter table public.tasks replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and tablename = 'tasks') then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;

-- =============================================================================
--  7. DATOS INICIALES — reemplazá por tu email (el mismo con el que entrás a la PWA)
-- =============================================================================
-- insert into public.app_users (email) values ('tu-email@dominio.com') on conflict do nothing;
