-- ============================================================
-- INSTALACIÓN COMPLETA desde cero (migraciones 0001 a 0006 en orden).
-- Usar SOLO en un proyecto nuevo y vacío. Si ya instalaste una versión
-- anterior, ejecutá únicamente las migraciones nuevas (ver README).
-- ============================================================

-- >>>>>>>>>> migrations/0001_init.sql
-- Barbería app: esquema inicial (multi-barbería, multi-barbero, reservas sin cuenta)
-- Modelo de seguridad:
--   * RLS en todas las tablas; el rol anon NO accede a tablas directamente.
--   * Lo público (perfil, disponibilidad, gestión por token) sale de funciones SECURITY DEFINER.
--   * crear_reserva solo la puede ejecutar service_role (el servidor Next.js valida Turnstile antes).

create extension if not exists btree_gist;

-- ---------------------------------------------------------------- tablas

create table public.barberias (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  nombre text not null,
  modo text not null default 'local' check (modo in ('local','domicilio','ambos')),
  direccion text,
  lat double precision,
  lng double precision,
  place_id text,
  radio_cobertura_km numeric,
  recargo_traslado numeric not null default 0,
  buffer_traslado_min int not null default 0 check (buffer_traslado_min >= 0),
  horas_min_cancelacion int not null default 2 check (horas_min_cancelacion >= 0),
  anticipacion_min int not null default 30 check (anticipacion_min >= 0),
  paso_min int not null default 30 check (paso_min between 5 and 120),
  banner_activo boolean not null default false,
  banner_texto text,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  created_at timestamptz not null default now()
);
create index on public.barberias (owner_id);

create table public.barberos (
  id uuid primary key default gen_random_uuid(),
  barberia_id uuid not null references public.barberias(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  unique (id, barberia_id)
);
create index on public.barberos (barberia_id);

create table public.servicios (
  id uuid primary key default gen_random_uuid(),
  barberia_id uuid not null references public.barberias(id) on delete cascade,
  nombre text not null,
  precio numeric not null default 0 check (precio >= 0),
  duracion_min int not null check (duracion_min between 5 and 480),
  activo boolean not null default true,
  unique (id, barberia_id)
);
create index on public.servicios (barberia_id);

create table public.horarios (
  id uuid primary key default gen_random_uuid(),
  barbero_id uuid not null references public.barberos(id) on delete cascade,
  dia_semana int not null check (dia_semana between 0 and 6), -- 0 = domingo
  desde time not null,
  hasta time not null,
  check (hasta > desde)
);
create index on public.horarios (barbero_id, dia_semana);

create table public.bloqueos (
  id uuid primary key default gen_random_uuid(),
  barbero_id uuid not null references public.barberos(id) on delete cascade,
  inicio timestamptz not null,
  fin timestamptz not null,
  motivo text,
  check (fin > inicio)
);
create index on public.bloqueos (barbero_id, inicio);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  barberia_id uuid not null references public.barberias(id) on delete cascade,
  nombre text not null,
  apellido text,
  telefono text,
  email text,
  edad int check (edad is null or edad between 1 and 120),
  observaciones text,
  direccion text,
  lat double precision,
  lng double precision,
  consentimiento_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, barberia_id)
);
create unique index clientes_email_uk on public.clientes (barberia_id, lower(email)) where email is not null;
create index on public.clientes (barberia_id, lower(nombre));

create table public.turnos (
  id uuid primary key default gen_random_uuid(),
  barberia_id uuid not null,
  barbero_id uuid not null,
  cliente_id uuid not null,
  servicio_id uuid not null,
  inicio timestamptz not null,
  fin timestamptz not null,
  ocupa_hasta timestamptz not null, -- fin + tiempo de traslado (domicilio)
  modalidad text not null check (modalidad in ('local','domicilio')),
  direccion text,
  lat double precision,
  lng double precision,
  indicaciones text,
  precio numeric,
  estado text not null default 'confirmado' check (estado in ('confirmado','cancelado','completado','ausente')),
  gestion_token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  agendado_at timestamptz not null default now(),
  confirmacion_enviada_at timestamptz,
  recordatorio_24h_at timestamptz,
  recordatorio_2h_at timestamptz,
  created_at timestamptz not null default now(),
  check (fin > inicio and ocupa_hasta >= fin),
  foreign key (barbero_id, barberia_id) references public.barberos (id, barberia_id),
  foreign key (cliente_id, barberia_id) references public.clientes (id, barberia_id),
  foreign key (servicio_id, barberia_id) references public.servicios (id, barberia_id),
  -- evita doble reserva aunque dos personas reserven a la vez
  constraint turnos_sin_solape exclude using gist (
    barbero_id with =,
    tstzrange(inicio, ocupa_hasta) with &&
  ) where (estado <> 'cancelado')
);
create index on public.turnos (barberia_id, inicio);
create index on public.turnos (cliente_id);

create table public.cortes (
  id uuid primary key default gen_random_uuid(),
  barberia_id uuid not null,
  cliente_id uuid not null,
  turno_id uuid references public.turnos(id) on delete set null,
  fecha date not null default current_date,
  servicio text,
  nota text,
  precio numeric,
  fotos text[] not null default '{}', -- rutas en el bucket privado "cortes"
  created_at timestamptz not null default now(),
  foreign key (cliente_id, barberia_id) references public.clientes (id, barberia_id) on delete cascade
);
create index on public.cortes (cliente_id, fecha desc);

-- ---------------------------------------------------------------- helpers

create function public.es_dueno(p_barberia uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from barberias where id = p_barberia and owner_id = auth.uid());
$$;

create function public.es_dueno_barbero(p_barbero uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from barberos b join barberias ba on ba.id = b.barberia_id
    where b.id = p_barbero and ba.owner_id = auth.uid());
$$;

create function public._distancia_km(a_lat double precision, a_lng double precision,
                                     b_lat double precision, b_lng double precision)
returns double precision language sql immutable as $$
  select 6371 * acos(least(1, greatest(-1,
    cos(radians(a_lat)) * cos(radians(b_lat)) * cos(radians(b_lng) - radians(a_lng))
    + sin(radians(a_lat)) * sin(radians(b_lat)))));
$$;

-- al crear una barbería se crea su primer barbero
create function public._barberia_nuevo_barbero() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into barberos (barberia_id, nombre) values (new.id, new.nombre);
  return new;
end $$;
create trigger barberia_nuevo_barbero after insert on public.barberias
  for each row execute function public._barberia_nuevo_barbero();

-- calcula fin / ocupa_hasta / precio de un turno
create function public._turno_calc() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_dur int; v_precio numeric; v_buffer int; v_recargo numeric;
begin
  select s.duracion_min, s.precio into v_dur, v_precio from servicios s
    where s.id = new.servicio_id and s.barberia_id = new.barberia_id;
  select b.buffer_traslado_min, b.recargo_traslado into v_buffer, v_recargo from barberias b
    where b.id = new.barberia_id;
  new.fin := new.inicio + make_interval(mins => v_dur);
  new.ocupa_hasta := new.fin + case when new.modalidad = 'domicilio'
                                    then make_interval(mins => v_buffer) else interval '0' end;
  if tg_op = 'INSERT' and new.precio is null then
    new.precio := v_precio + case when new.modalidad = 'domicilio' then v_recargo else 0 end;
  end if;
  return new;
end $$;
create trigger turno_calc before insert or update of inicio, servicio_id, modalidad on public.turnos
  for each row execute function public._turno_calc();

-- ---------------------------------------------------------------- disponibilidad

create function public._slots(p_barberia uuid, p_barbero uuid, p_servicio uuid, p_fecha date,
                              p_modalidad text, p_excluir uuid default null)
returns table (slot timestamptz)
language sql stable security definer set search_path = public as $$
  select distinct s.t
  from barberias ba
  join servicios sv on sv.id = p_servicio and sv.barberia_id = ba.id and sv.activo
  join barberos br  on br.id = p_barbero  and br.barberia_id = ba.id and br.activo
  join horarios h   on h.barbero_id = br.id and h.dia_semana = extract(dow from p_fecha)::int
  cross join lateral generate_series(
      ((p_fecha + h.desde) at time zone ba.timezone),
      ((p_fecha + h.hasta) at time zone ba.timezone) - make_interval(mins => sv.duracion_min),
      make_interval(mins => ba.paso_min)) as s(t)
  where ba.id = p_barberia
    and s.t >= now() + make_interval(mins => ba.anticipacion_min)
    and not exists (
      select 1 from turnos tu
      where tu.barbero_id = br.id and tu.estado <> 'cancelado' and tu.id is distinct from p_excluir
        and tstzrange(tu.inicio, tu.ocupa_hasta) && tstzrange(s.t,
              s.t + make_interval(mins => sv.duracion_min
                    + case when p_modalidad = 'domicilio' then ba.buffer_traslado_min else 0 end)))
    and not exists (
      select 1 from bloqueos bl
      where bl.barbero_id = br.id
        and tstzrange(bl.inicio, bl.fin) && tstzrange(s.t, s.t + make_interval(mins => sv.duracion_min)))
  order by 1;
$$;

-- perfil público: solo campos seguros. La dirección/coordenadas solo se publican si hay local.
create function public.perfil_publico(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'slug', b.slug, 'nombre', b.nombre, 'modo', b.modo,
    'direccion', case when b.modo in ('local','ambos') then b.direccion end,
    'lat', case when b.modo in ('local','ambos') then b.lat end,
    'lng', case when b.modo in ('local','ambos') then b.lng end,
    'radio_cobertura_km', case when b.modo in ('domicilio','ambos') then b.radio_cobertura_km end,
    'recargo_traslado', case when b.modo in ('domicilio','ambos') then b.recargo_traslado end,
    'horas_min_cancelacion', b.horas_min_cancelacion,
    'banner', case when b.banner_activo then b.banner_texto end,
    'timezone', b.timezone,
    'barberos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre) order by x.nombre)
                          from barberos x where x.barberia_id = b.id and x.activo), '[]'),
    'servicios', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre,
                              'precio', s.precio, 'duracion_min', s.duracion_min) order by s.nombre)
                          from servicios s where s.barberia_id = b.id and s.activo), '[]'))
  from barberias b where b.slug = p_slug;
$$;

create function public.disponibilidad(p_slug text, p_barbero uuid, p_servicio uuid,
                                      p_fecha date, p_modalidad text default 'local')
returns setof timestamptz
language sql stable security definer set search_path = public as $$
  select sl.slot from barberias b, lateral public._slots(b.id, p_barbero, p_servicio, p_fecha, p_modalidad) sl
  where b.slug = p_slug;
$$;

-- ---------------------------------------------------------------- reservas

create function public.crear_reserva(
  p_slug text, p_barbero uuid, p_servicio uuid, p_inicio timestamptz, p_modalidad text,
  p_nombre text, p_apellido text, p_telefono text, p_email text,
  p_direccion text default null, p_lat double precision default null, p_lng double precision default null,
  p_indicaciones text default null, p_consentimiento boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b barberias; v_fecha date; v_cliente uuid; v_turno turnos; v_email text;
begin
  select * into b from barberias where slug = p_slug;
  if not found then raise exception 'barberia_no_existe'; end if;
  if not p_consentimiento then raise exception 'falta_consentimiento'; end if;
  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_telefono), '') = '' or coalesce(trim(p_email), '') = ''
     or position('@' in p_email) = 0 then
    raise exception 'datos_invalidos';
  end if;
  if p_modalidad not in ('local','domicilio') or (b.modo <> 'ambos' and b.modo <> p_modalidad) then
    raise exception 'modalidad_no_disponible';
  end if;
  if p_modalidad = 'domicilio' then
    if p_lat is null or p_lng is null or coalesce(trim(p_direccion), '') = '' then
      raise exception 'direccion_requerida';
    end if;
    if b.radio_cobertura_km is not null and b.lat is not null
       and _distancia_km(b.lat, b.lng, p_lat, p_lng) > b.radio_cobertura_km then
      raise exception 'fuera_de_zona';
    end if;
  end if;

  v_fecha := (p_inicio at time zone b.timezone)::date;
  if not exists (select 1 from _slots(b.id, p_barbero, p_servicio, v_fecha, p_modalidad) s where s.slot = p_inicio) then
    raise exception 'horario_no_disponible';
  end if;

  v_email := lower(trim(p_email));
  -- cliente existente por email: se vincula, NO se pisan los datos que cargó el barbero
  select id into v_cliente from clientes where barberia_id = b.id and lower(email) = v_email;
  if v_cliente is null then
    insert into clientes (barberia_id, nombre, apellido, telefono, email, direccion, lat, lng, consentimiento_at)
    values (b.id, trim(p_nombre), nullif(trim(p_apellido), ''), trim(p_telefono), v_email,
            case when p_modalidad = 'domicilio' then p_direccion end,
            case when p_modalidad = 'domicilio' then p_lat end,
            case when p_modalidad = 'domicilio' then p_lng end, now())
    returning id into v_cliente;
  else
    update clientes set consentimiento_at = coalesce(consentimiento_at, now()) where id = v_cliente;
  end if;

  begin
    insert into turnos (barberia_id, barbero_id, cliente_id, servicio_id, inicio, fin, ocupa_hasta,
                        modalidad, direccion, lat, lng, indicaciones)
    values (b.id, p_barbero, v_cliente, p_servicio, p_inicio, p_inicio, p_inicio, p_modalidad,
            case when p_modalidad = 'domicilio' then p_direccion end,
            case when p_modalidad = 'domicilio' then p_lat end,
            case when p_modalidad = 'domicilio' then p_lng end,
            p_indicaciones)
    returning * into v_turno;
  exception when exclusion_violation then
    raise exception 'horario_no_disponible';
  end;

  return jsonb_build_object(
    'turno_id', v_turno.id, 'gestion_token', v_turno.gestion_token,
    'inicio', v_turno.inicio, 'fin', v_turno.fin, 'precio', v_turno.precio,
    'modalidad', v_turno.modalidad, 'direccion_turno', v_turno.direccion,
    'indicaciones', v_turno.indicaciones,
    'cliente', jsonb_build_object('nombre', trim(p_nombre), 'apellido', p_apellido,
                                  'telefono', p_telefono, 'email', v_email),
    'servicio', (select s.nombre from servicios s where s.id = p_servicio),
    'barbero', (select x.nombre from barberos x where x.id = p_barbero),
    'barberia', jsonb_build_object('nombre', b.nombre, 'slug', b.slug,
                  'direccion', case when p_modalidad = 'local' then b.direccion end,
                  'lat', case when p_modalidad = 'local' then b.lat end,
                  'lng', case when p_modalidad = 'local' then b.lng end,
                  'timezone', b.timezone),
    'email_barbero', (select u.email from auth.users u where u.id = b.owner_id));
end $$;

-- gestión por token (el cliente no tiene cuenta: el token del mail es la credencial)
create function public.ver_turno(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'inicio', t.inicio, 'fin', t.fin, 'estado', t.estado, 'modalidad', t.modalidad,
    'servicio_id', t.servicio_id, 'barbero_id', t.barbero_id,
    'servicio', s.nombre, 'barbero', x.nombre, 'precio', t.precio,
    'direccion_turno', t.direccion,
    'puede_modificar', t.estado = 'confirmado'
        and t.inicio - make_interval(hours => b.horas_min_cancelacion) > now(),
    'horas_min_cancelacion', b.horas_min_cancelacion,
    'barberia', jsonb_build_object('nombre', b.nombre, 'slug', b.slug, 'timezone', b.timezone,
        'direccion', case when t.modalidad = 'local' then b.direccion end,
        'lat', case when t.modalidad = 'local' then b.lat end,
        'lng', case when t.modalidad = 'local' then b.lng end))
  from turnos t join barberias b on b.id = t.barberia_id
  join servicios s on s.id = t.servicio_id join barberos x on x.id = t.barbero_id
  where t.gestion_token = p_token;
$$;

create function public.cancelar_turno(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t turnos; b barberias;
begin
  select * into t from turnos where gestion_token = p_token for update;
  if not found then raise exception 'turno_no_existe'; end if;
  select * into b from barberias where id = t.barberia_id;
  if t.estado <> 'confirmado' then raise exception 'turno_no_modificable'; end if;
  if t.inicio - make_interval(hours => b.horas_min_cancelacion) <= now() then
    raise exception 'fuera_de_plazo';
  end if;
  update turnos set estado = 'cancelado' where id = t.id;
  return jsonb_build_object('ok', true, 'turno_id', t.id,
    'email_barbero', (select u.email from auth.users u where u.id = b.owner_id));
end $$;

create function public.reprogramar_turno(p_token text, p_nuevo_inicio timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t turnos; b barberias;
begin
  select * into t from turnos where gestion_token = p_token for update;
  if not found then raise exception 'turno_no_existe'; end if;
  select * into b from barberias where id = t.barberia_id;
  if t.estado <> 'confirmado' then raise exception 'turno_no_modificable'; end if;
  if t.inicio - make_interval(hours => b.horas_min_cancelacion) <= now() then
    raise exception 'fuera_de_plazo';
  end if;
  if not exists (select 1 from _slots(b.id, t.barbero_id, t.servicio_id,
                   (p_nuevo_inicio at time zone b.timezone)::date, t.modalidad, t.id) s
                 where s.slot = p_nuevo_inicio) then
    raise exception 'horario_no_disponible';
  end if;
  begin
    update turnos set inicio = p_nuevo_inicio, agendado_at = now(),
           recordatorio_24h_at = null, recordatorio_2h_at = null
    where id = t.id;
  exception when exclusion_violation then
    raise exception 'horario_no_disponible';
  end;
  return jsonb_build_object('ok', true, 'turno_id', t.id,
    'email_barbero', (select u.email from auth.users u where u.id = b.owner_id));
end $$;

-- ---------------------------------------------------------------- recordatorios (n8n)

-- Reclama de forma atómica los turnos que necesitan recordatorio: dos ejecuciones
-- simultáneas de n8n nunca reciben el mismo turno. Si el envío falla, n8n llama a
-- liberar_recordatorio para reintentar en la próxima corrida.
create function public.reclamar_recordatorios(p_tipo text, p_limite int default 50)
returns setof jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_tipo not in ('24h','2h') then raise exception 'tipo_invalido'; end if;
  return query
  with due as (
    select t.id from turnos t
    where t.estado = 'confirmado'
      and ((p_tipo = '24h' and t.recordatorio_24h_at is null
              and t.inicio <= now() + interval '24 hours' and t.inicio > now() + interval '3 hours'
              and t.agendado_at < t.inicio - interval '24 hours')
        or (p_tipo = '2h' and t.recordatorio_2h_at is null
              and t.inicio <= now() + interval '2 hours' and t.inicio > now()
              and t.agendado_at < t.inicio - interval '2 hours'))
    order by t.inicio limit p_limite
    for update skip locked),
  upd as (
    update turnos t set
      recordatorio_24h_at = case when p_tipo = '24h' then now() else t.recordatorio_24h_at end,
      recordatorio_2h_at  = case when p_tipo = '2h'  then now() else t.recordatorio_2h_at end
    from due where t.id = due.id returning t.*)
  select jsonb_build_object(
    'turno_id', u.id, 'tipo', p_tipo, 'inicio', u.inicio, 'modalidad', u.modalidad,
    'gestion_token', u.gestion_token, 'direccion_turno', u.direccion,
    'cliente_nombre', c.nombre, 'cliente_email', c.email,
    'servicio', s.nombre, 'barbero', x.nombre,
    'barberia', b.nombre, 'timezone', b.timezone,
    'direccion_local', case when u.modalidad = 'local' then b.direccion end,
    'lat', case when u.modalidad = 'local' then b.lat end,
    'lng', case when u.modalidad = 'local' then b.lng end)
  from upd u join clientes c on c.id = u.cliente_id
  join servicios s on s.id = u.servicio_id join barberos x on x.id = u.barbero_id
  join barberias b on b.id = u.barberia_id;
end $$;

create function public.liberar_recordatorio(p_turno uuid, p_tipo text) returns void
language sql security definer set search_path = public as $$
  update turnos set
    recordatorio_24h_at = case when p_tipo = '24h' then null else recordatorio_24h_at end,
    recordatorio_2h_at  = case when p_tipo = '2h'  then null else recordatorio_2h_at end
  where id = p_turno;
$$;

-- ---------------------------------------------------------------- RLS

alter table public.barberias enable row level security;
alter table public.barberos  enable row level security;
alter table public.servicios enable row level security;
alter table public.horarios  enable row level security;
alter table public.bloqueos  enable row level security;
alter table public.clientes  enable row level security;
alter table public.turnos    enable row level security;
alter table public.cortes    enable row level security;

create policy barberias_owner on public.barberias for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy barberos_owner  on public.barberos  for all to authenticated
  using (public.es_dueno(barberia_id)) with check (public.es_dueno(barberia_id));
create policy servicios_owner on public.servicios for all to authenticated
  using (public.es_dueno(barberia_id)) with check (public.es_dueno(barberia_id));
create policy horarios_owner  on public.horarios  for all to authenticated
  using (public.es_dueno_barbero(barbero_id)) with check (public.es_dueno_barbero(barbero_id));
create policy bloqueos_owner  on public.bloqueos  for all to authenticated
  using (public.es_dueno_barbero(barbero_id)) with check (public.es_dueno_barbero(barbero_id));
create policy clientes_owner  on public.clientes  for all to authenticated
  using (public.es_dueno(barberia_id)) with check (public.es_dueno(barberia_id));
create policy turnos_owner    on public.turnos    for all to authenticated
  using (public.es_dueno(barberia_id)) with check (public.es_dueno(barberia_id));
create policy cortes_owner    on public.cortes    for all to authenticated
  using (public.es_dueno(barberia_id)) with check (public.es_dueno(barberia_id));

-- anon: sin acceso a tablas. authenticated: solo lo que dicen las policies.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------- permisos de funciones

revoke all on function public.es_dueno(uuid), public.es_dueno_barbero(uuid),
  public._slots(uuid, uuid, uuid, date, text, uuid),
  public._distancia_km(double precision, double precision, double precision, double precision),
  public._barberia_nuevo_barbero(), public._turno_calc(),
  public.perfil_publico(text), public.disponibilidad(text, uuid, uuid, date, text),
  public.crear_reserva(text, uuid, uuid, timestamptz, text, text, text, text, text, text,
                       double precision, double precision, text, boolean),
  public.ver_turno(text), public.cancelar_turno(text), public.reprogramar_turno(text, timestamptz),
  public.reclamar_recordatorios(text, int), public.liberar_recordatorio(uuid, text)
  from public, anon, authenticated;

-- las policies llaman a estos helpers como usuario autenticado
grant execute on function public.es_dueno(uuid), public.es_dueno_barbero(uuid) to authenticated;
-- lo público (consultas y gestión por token del mail)
grant execute on function public.perfil_publico(text), public.disponibilidad(text, uuid, uuid, date, text),
  public.ver_turno(text), public.cancelar_turno(text), public.reprogramar_turno(text, timestamptz)
  to anon, authenticated;
-- solo el servidor (Next.js / n8n con service_role)
grant execute on function
  public.crear_reserva(text, uuid, uuid, timestamptz, text, text, text, text, text, text,
                       double precision, double precision, text, boolean),
  public.reclamar_recordatorios(text, int), public.liberar_recordatorio(uuid, text)
  to service_role;

-- ---------------------------------------------------------------- storage (fotos de cortes)

insert into storage.buckets (id, name, public) values ('cortes', 'cortes', false)
  on conflict (id) do nothing;

-- ruta: {barberia_id}/{cliente_id}/archivo.jpg
create policy cortes_fotos_owner on storage.objects for all to authenticated
  using (bucket_id = 'cortes' and exists (
    select 1 from public.barberias b
    where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()))
  with check (bucket_id = 'cortes' and exists (
    select 1 from public.barberias b
    where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));

-- >>>>>>>>>> migrations/0002_fichas_horarios.sql
-- Número de ficha por barbería (correlativo, a prueba de reservas simultáneas) y
-- guardado atómico de los horarios que habilita el barbero.

alter table public.barberias add column siguiente_ficha int not null default 1;
alter table public.clientes add column numero int;

-- fichas que ya existieran: numeración por orden de creación
with n as (
  select id, row_number() over (partition by barberia_id order by created_at, id) as rn from public.clientes
)
update public.clientes c set numero = n.rn from n where n.id = c.id;
update public.barberias b set siguiente_ficha =
  coalesce((select max(c.numero) + 1 from public.clientes c where c.barberia_id = b.id), 1);

alter table public.clientes alter column numero set not null;
create unique index clientes_numero_uk on public.clientes (barberia_id, numero);

-- asigna el número al crear la ficha (se ignora cualquier valor enviado por el cliente)
create function public._cliente_numero() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update barberias set siguiente_ficha = siguiente_ficha + 1
    where id = new.barberia_id returning siguiente_ficha - 1 into new.numero;
  if new.numero is null then raise exception 'barberia_no_existe'; end if;
  return new;
end $$;
create trigger cliente_numero before insert on public.clientes
  for each row execute function public._cliente_numero();

-- el número de ficha nunca cambia
create function public._cliente_numero_fijo() returns trigger
language plpgsql as $$
begin
  new.numero := old.numero;
  return new;
end $$;
create trigger cliente_numero_fijo before update on public.clientes
  for each row execute function public._cliente_numero_fijo();

-- el contador solo lo mueve el trigger de arriba (profundidad 2), no el dueño con un UPDATE directo
create function public._barberia_contador_fijo() returns trigger
language plpgsql as $$
begin
  if pg_trigger_depth() = 1 then new.siguiente_ficha := old.siguiente_ficha; end if;
  return new;
end $$;
create trigger barberia_contador_fijo before update on public.barberias
  for each row execute function public._barberia_contador_fijo();

revoke all on function public._cliente_numero(), public._cliente_numero_fijo(), public._barberia_contador_fijo()
  from public, anon, authenticated;

-- Reemplaza todos los horarios de un barbero en una sola transacción.
-- SECURITY INVOKER: las políticas RLS siguen decidiendo si el barbero es del usuario.
create function public.guardar_horarios(p_barbero uuid, p_horarios jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  delete from horarios where barbero_id = p_barbero;
  insert into horarios (barbero_id, dia_semana, desde, hasta)
  select p_barbero, (x->>'dia_semana')::int, (x->>'desde')::time, (x->>'hasta')::time
  from jsonb_array_elements(p_horarios) x;
  if exists (
    select 1 from horarios a join horarios b
      on a.barbero_id = b.barbero_id and a.dia_semana = b.dia_semana and a.id < b.id
     and a.desde < b.hasta and b.desde < a.hasta
    where a.barbero_id = p_barbero) then
    raise exception 'horarios_superpuestos';
  end if;
end $$;
revoke all on function public.guardar_horarios(uuid, jsonb) from public, anon;
grant execute on function public.guardar_horarios(uuid, jsonb) to authenticated;

-- Bloquea días (vacaciones, feriados) o franjas horarias en la zona horaria de la barbería.
-- Devuelve cuántos turnos confirmados ya reservados caen en el período, para avisarle al barbero.
create function public.bloquear_dias(p_barbero uuid, p_desde date, p_hasta date,
                                     p_hora_desde time default null, p_hora_hasta time default null,
                                     p_motivo text default null) returns int
language plpgsql security invoker set search_path = public as $$
declare tz text; v_ini timestamptz; v_fin timestamptz; v_conflictos int;
begin
  select ba.timezone into tz from barberos b join barberias ba on ba.id = b.barberia_id where b.id = p_barbero;
  if tz is null then raise exception 'barbero_no_existe'; end if;
  if p_hasta < p_desde then raise exception 'rango_invalido'; end if;
  v_ini := (p_desde + coalesce(p_hora_desde, time '00:00')) at time zone tz;
  v_fin := case when p_hora_hasta is null then ((p_hasta + 1)::timestamp) at time zone tz
                else (p_hasta + p_hora_hasta) at time zone tz end;
  if v_fin <= v_ini then raise exception 'rango_invalido'; end if;
  insert into bloqueos (barbero_id, inicio, fin, motivo) values (p_barbero, v_ini, v_fin, p_motivo);
  select count(*) into v_conflictos from turnos
    where barbero_id = p_barbero and estado = 'confirmado' and tstzrange(inicio, fin) && tstzrange(v_ini, v_fin);
  return v_conflictos;
end $$;
revoke all on function public.bloquear_dias(uuid, date, date, time, time, text) from public, anon;
grant execute on function public.bloquear_dias(uuid, date, date, time, time, text) to authenticated;

-- >>>>>>>>>> migrations/0003_busqueda_fichas.sql
-- Fichas: búsqueda ordenada y completa, y reconocimiento de clientes ya cargados.

-- minúsculas sin tildes (ni ñ) para buscar y ordenar; sin extensiones
create function public._norm(t text) returns text language sql immutable as $$
  select translate(lower(coalesce(t, '')), 'áéíóúüñ', 'aeiouun');
$$;
grant execute on function public._norm(text) to authenticated;

-- Cada palabra de la búsqueda debe aparecer en nombre, apellido, teléfono o mail
-- ("juan perez" encuentra a Juan Pérez). Un número (o #12) también busca por n° de ficha.
-- Orden alfabético por primer nombre. SECURITY INVOKER: RLS limita a las fichas del usuario.
create function public.buscar_clientes(p_q text default '', p_limite int default 500)
returns setof public.clientes
language sql stable security invoker set search_path = public as $$
  with t as (
    select replace(replace(replace(_norm(term), '\', '\\'), '%', '\%'), '_', '\_') as patron, term
    from unnest(regexp_split_to_array(trim(coalesce(p_q, '')), '\s+')) as term
    where trim(coalesce(p_q, '')) <> ''
  )
  select c.* from clientes c
  where not exists (
    select 1 from t where not (
      _norm(c.nombre) like '%' || t.patron || '%'
      or _norm(c.apellido) like '%' || t.patron || '%'
      or _norm(c.telefono) like '%' || t.patron || '%'
      or _norm(c.email) like '%' || t.patron || '%'
      or (t.term ~ '^#?[0-9]{1,9}$' and c.numero = replace(t.term, '#', '')::int)))
  order by _norm(c.nombre), _norm(c.apellido), c.numero
  limit least(greatest(p_limite, 1), 1000);
$$;
revoke all on function public.buscar_clientes(text, int) from public, anon;
grant execute on function public.buscar_clientes(text, int) to authenticated;

-- crear_reserva: completa la ficha con los datos del turno y reconoce clientes cargados a mano
create or replace function public.crear_reserva(
  p_slug text, p_barbero uuid, p_servicio uuid, p_inicio timestamptz, p_modalidad text,
  p_nombre text, p_apellido text, p_telefono text, p_email text,
  p_direccion text default null, p_lat double precision default null, p_lng double precision default null,
  p_indicaciones text default null, p_consentimiento boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b barberias; v_fecha date; v_cliente uuid; v_turno turnos; v_email text; v_tel text;
begin
  select * into b from barberias where slug = p_slug;
  if not found then raise exception 'barberia_no_existe'; end if;
  if not p_consentimiento then raise exception 'falta_consentimiento'; end if;
  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_telefono), '') = '' or coalesce(trim(p_email), '') = ''
     or position('@' in p_email) = 0 then
    raise exception 'datos_invalidos';
  end if;
  if p_modalidad not in ('local','domicilio') or (b.modo <> 'ambos' and b.modo <> p_modalidad) then
    raise exception 'modalidad_no_disponible';
  end if;
  if p_modalidad = 'domicilio' then
    if p_lat is null or p_lng is null or coalesce(trim(p_direccion), '') = '' then
      raise exception 'direccion_requerida';
    end if;
    if b.radio_cobertura_km is not null and b.lat is not null
       and _distancia_km(b.lat, b.lng, p_lat, p_lng) > b.radio_cobertura_km then
      raise exception 'fuera_de_zona';
    end if;
  end if;

  v_fecha := (p_inicio at time zone b.timezone)::date;
  if not exists (select 1 from _slots(b.id, p_barbero, p_servicio, v_fecha, p_modalidad) s where s.slot = p_inicio) then
    raise exception 'horario_no_disponible';
  end if;

  v_email := lower(trim(p_email));
  select id into v_cliente from clientes where barberia_id = b.id and lower(email) = v_email;

  -- ficha cargada a mano por el barbero (sin mail): se reconoce por los últimos 8 dígitos del
  -- teléfono y se le agrega el mail. Si la ficha ya tiene otro mail, no se toca (evita secuestros).
  if v_cliente is null then
    v_tel := right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 8);
    if length(v_tel) = 8 then
      select id into v_cliente from clientes
        where barberia_id = b.id and email is null
          and right(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), 8) = v_tel
        order by created_at limit 1;
      if v_cliente is not null then
        update clientes set email = v_email where id = v_cliente;
      end if;
    end if;
  end if;

  if v_cliente is null then
    insert into clientes (barberia_id, nombre, apellido, telefono, email, direccion, lat, lng, consentimiento_at)
    values (b.id, trim(p_nombre), nullif(trim(p_apellido), ''), trim(p_telefono), v_email,
            case when p_modalidad = 'domicilio' then p_direccion end,
            case when p_modalidad = 'domicilio' then p_lat end,
            case when p_modalidad = 'domicilio' then p_lng end, now())
    returning id into v_cliente;
  else
    -- ficha existente: solo se completan los campos vacíos; lo que cargó el barbero no se pisa
    update clientes set
      apellido = coalesce(apellido, nullif(trim(p_apellido), '')),
      telefono = coalesce(telefono, nullif(trim(p_telefono), '')),
      direccion = case when direccion is null and p_modalidad = 'domicilio' then p_direccion else direccion end,
      lat = case when direccion is null and p_modalidad = 'domicilio' then p_lat else lat end,
      lng = case when direccion is null and p_modalidad = 'domicilio' then p_lng else lng end,
      consentimiento_at = coalesce(consentimiento_at, now())
    where id = v_cliente;
  end if;

  begin
    insert into turnos (barberia_id, barbero_id, cliente_id, servicio_id, inicio, fin, ocupa_hasta,
                        modalidad, direccion, lat, lng, indicaciones)
    values (b.id, p_barbero, v_cliente, p_servicio, p_inicio, p_inicio, p_inicio, p_modalidad,
            case when p_modalidad = 'domicilio' then p_direccion end,
            case when p_modalidad = 'domicilio' then p_lat end,
            case when p_modalidad = 'domicilio' then p_lng end,
            p_indicaciones)
    returning * into v_turno;
  exception when exclusion_violation then
    raise exception 'horario_no_disponible';
  end;

  return jsonb_build_object(
    'turno_id', v_turno.id, 'gestion_token', v_turno.gestion_token,
    'inicio', v_turno.inicio, 'fin', v_turno.fin, 'precio', v_turno.precio,
    'modalidad', v_turno.modalidad, 'direccion_turno', v_turno.direccion,
    'indicaciones', v_turno.indicaciones,
    'cliente', jsonb_build_object('nombre', trim(p_nombre), 'apellido', p_apellido,
                                  'telefono', p_telefono, 'email', v_email),
    'servicio', (select s.nombre from servicios s where s.id = p_servicio),
    'barbero', (select x.nombre from barberos x where x.id = p_barbero),
    'barberia', jsonb_build_object('nombre', b.nombre, 'slug', b.slug,
                  'direccion', case when p_modalidad = 'local' then b.direccion end,
                  'lat', case when p_modalidad = 'local' then b.lat end,
                  'lng', case when p_modalidad = 'local' then b.lng end,
                  'timezone', b.timezone),
    'email_barbero', (select u.email from auth.users u where u.id = b.owner_id));
end $$;

revoke all on function public.crear_reserva(text, uuid, uuid, timestamptz, text, text, text, text, text, text,
                       double precision, double precision, text, boolean) from public, anon, authenticated;
grant execute on function public.crear_reserva(text, uuid, uuid, timestamptz, text, text, text, text, text, text,
                       double precision, double precision, text, boolean) to service_role;

-- >>>>>>>>>> migrations/0004_aperturas.sql
-- Fechas abiertas fuera del horario semanal (ej: un domingo extra).
-- Regla de prioridad: un bloqueo (vacaciones/día libre) siempre le gana a un horario o a una apertura.

create table public.aperturas (
  id uuid primary key default gen_random_uuid(),
  barbero_id uuid not null references public.barberos(id) on delete cascade,
  inicio timestamptz not null,
  fin timestamptz not null,
  motivo text,
  check (fin > inicio)
);
create index on public.aperturas (barbero_id, inicio);

alter table public.aperturas enable row level security;
create policy aperturas_owner on public.aperturas for all to authenticated
  using (public.es_dueno_barbero(barbero_id)) with check (public.es_dueno_barbero(barbero_id));
revoke all on public.aperturas from anon;
grant select, insert, update, delete on public.aperturas to authenticated;

-- Abre una fecha puntual en la zona horaria de la barbería. Devuelve cuántos bloqueos se
-- superponen (si hay alguno, esos horarios seguirán cerrados hasta quitar el bloqueo).
create function public.abrir_fecha(p_barbero uuid, p_fecha date, p_desde time, p_hasta time,
                                   p_motivo text default null) returns int
language plpgsql security invoker set search_path = public as $$
declare tz text; v_ini timestamptz; v_fin timestamptz;
begin
  select ba.timezone into tz from barberos b join barberias ba on ba.id = b.barberia_id where b.id = p_barbero;
  if tz is null then raise exception 'barbero_no_existe'; end if;
  if p_hasta <= p_desde then raise exception 'rango_invalido'; end if;
  v_ini := (p_fecha + p_desde) at time zone tz;
  v_fin := (p_fecha + p_hasta) at time zone tz;
  insert into aperturas (barbero_id, inicio, fin, motivo) values (p_barbero, v_ini, v_fin, p_motivo);
  return (select count(*) from bloqueos where barbero_id = p_barbero
            and tstzrange(inicio, fin) && tstzrange(v_ini, v_fin));
end $$;
revoke all on function public.abrir_fecha(uuid, date, time, time, text) from public, anon;
grant execute on function public.abrir_fecha(uuid, date, time, time, text) to authenticated;

-- _slots ahora suma las aperturas del día a los horarios semanales
create or replace function public._slots(p_barberia uuid, p_barbero uuid, p_servicio uuid, p_fecha date,
                                         p_modalidad text, p_excluir uuid default null)
returns table (slot timestamptz)
language sql stable security definer set search_path = public as $$
  select distinct s.t
  from barberias ba
  join servicios sv on sv.id = p_servicio and sv.barberia_id = ba.id and sv.activo
  join barberos br  on br.id = p_barbero  and br.barberia_id = ba.id and br.activo
  cross join lateral (
    select ((p_fecha + h.desde) at time zone ba.timezone) as ini,
           ((p_fecha + h.hasta) at time zone ba.timezone) as fin
    from horarios h
    where h.barbero_id = br.id and h.dia_semana = extract(dow from p_fecha)::int
    union
    select a.inicio, a.fin from aperturas a
    where a.barbero_id = br.id and (a.inicio at time zone ba.timezone)::date = p_fecha
  ) v
  cross join lateral generate_series(v.ini, v.fin - make_interval(mins => sv.duracion_min),
                                     make_interval(mins => ba.paso_min)) as s(t)
  where ba.id = p_barberia
    and s.t >= now() + make_interval(mins => ba.anticipacion_min)
    and not exists (
      select 1 from turnos tu
      where tu.barbero_id = br.id and tu.estado <> 'cancelado' and tu.id is distinct from p_excluir
        and tstzrange(tu.inicio, tu.ocupa_hasta) && tstzrange(s.t,
              s.t + make_interval(mins => sv.duracion_min
                    + case when p_modalidad = 'domicilio' then ba.buffer_traslado_min else 0 end)))
    and not exists (
      select 1 from bloqueos bl
      where bl.barbero_id = br.id
        and tstzrange(bl.inicio, bl.fin) && tstzrange(s.t, s.t + make_interval(mins => sv.duracion_min)))
  order by 1;
$$;
revoke all on function public._slots(uuid, uuid, uuid, date, text, uuid) from public, anon, authenticated;

-- >>>>>>>>>> migrations/0005_turno_manual.sql
-- Turno cargado por el barbero (cliente que llama o llega sin reservar).
-- A diferencia de la reserva online, el barbero puede agendar fuera de su horario habitual;
-- lo único que no se permite es superponer otro turno (constraint turnos_sin_solape).
-- SECURITY INVOKER: las políticas RLS garantizan que solo opera sobre su propia barbería.
create function public.crear_turno_manual(
  p_barbero uuid, p_servicio uuid, p_cliente uuid, p_fecha date, p_hora time, p_modalidad text,
  p_direccion text default null, p_lat double precision default null, p_lng double precision default null,
  p_indicaciones text default null) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare b barberias; v_turno turnos; v_inicio timestamptz;
begin
  select ba.* into b from barberos br join barberias ba on ba.id = br.barberia_id where br.id = p_barbero;
  if not found then raise exception 'barbero_no_existe'; end if;
  if p_modalidad not in ('local','domicilio') or (b.modo <> 'ambos' and b.modo <> p_modalidad) then
    raise exception 'modalidad_no_disponible';
  end if;
  if p_modalidad = 'domicilio' and coalesce(trim(p_direccion), '') = '' then
    raise exception 'direccion_requerida';
  end if;
  v_inicio := (p_fecha + p_hora) at time zone b.timezone;
  begin
    insert into turnos (barberia_id, barbero_id, cliente_id, servicio_id, inicio, fin, ocupa_hasta,
                        modalidad, direccion, lat, lng, indicaciones)
    values (b.id, p_barbero, p_cliente, p_servicio, v_inicio, v_inicio, v_inicio, p_modalidad,
            case when p_modalidad = 'domicilio' then p_direccion end,
            case when p_modalidad = 'domicilio' then p_lat end,
            case when p_modalidad = 'domicilio' then p_lng end, p_indicaciones)
    returning * into v_turno;
  exception
    when exclusion_violation then raise exception 'horario_no_disponible';
    when foreign_key_violation then raise exception 'datos_invalidos';
  end;
  return jsonb_build_object('turno_id', v_turno.id, 'inicio', v_turno.inicio, 'fin', v_turno.fin,
                            'precio', v_turno.precio, 'gestion_token', v_turno.gestion_token);
end $$;
revoke all on function public.crear_turno_manual(uuid, uuid, uuid, date, time, text, text,
  double precision, double precision, text) from public, anon;
grant execute on function public.crear_turno_manual(uuid, uuid, uuid, date, time, text, text,
  double precision, double precision, text) to authenticated;

-- >>>>>>>>>> migrations/0006_marca_y_mapas.sql
-- Marca de cada barbería (logo + color) y coordenadas exactas del domicilio para Google Maps.
-- SI YA INSTALASTE 0001..0005: ejecutá solamente este archivo.

alter table public.barberias add column color_marca text not null default '#111827'
  check (color_marca ~ '^#[0-9a-fA-F]{6}$');
alter table public.barberias add column logo_path text;

-- Logos: bucket PÚBLICO (se muestran en la página de reservas y en los mails).
-- Solo el dueño puede subir, cambiar o borrar; ruta: {barberia_id}/archivo
insert into storage.buckets (id, name, public) values ('marcas', 'marcas', true)
  on conflict (id) do nothing;

create policy marcas_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'marcas' and exists (
    select 1 from public.barberias b
    where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));
create policy marcas_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'marcas' and exists (
    select 1 from public.barberias b
    where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));
create policy marcas_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'marcas' and exists (
    select 1 from public.barberias b
    where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));

-- Las funciones públicas ahora devuelven color y logo; reserva, turno y recordatorios
-- incluyen además las coordenadas del domicilio para armar el link de Google Maps.

create or replace function public.perfil_publico(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'slug', b.slug, 'nombre', b.nombre, 'modo', b.modo,
    'direccion', case when b.modo in ('local','ambos') then b.direccion end,
    'lat', case when b.modo in ('local','ambos') then b.lat end,
    'lng', case when b.modo in ('local','ambos') then b.lng end,
    'radio_cobertura_km', case when b.modo in ('domicilio','ambos') then b.radio_cobertura_km end,
    'recargo_traslado', case when b.modo in ('domicilio','ambos') then b.recargo_traslado end,
    'horas_min_cancelacion', b.horas_min_cancelacion,
    'banner', case when b.banner_activo then b.banner_texto end,
    'timezone', b.timezone, 'color', b.color_marca, 'logo_path', b.logo_path,
    'barberos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre) order by x.nombre)
                          from barberos x where x.barberia_id = b.id and x.activo), '[]'),
    'servicios', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre,
                              'precio', s.precio, 'duracion_min', s.duracion_min) order by s.nombre)
                          from servicios s where s.barberia_id = b.id and s.activo), '[]'))
  from barberias b where b.slug = p_slug;
$$;

create or replace function public.ver_turno(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'inicio', t.inicio, 'fin', t.fin, 'estado', t.estado, 'modalidad', t.modalidad,
    'servicio_id', t.servicio_id, 'barbero_id', t.barbero_id,
    'servicio', s.nombre, 'barbero', x.nombre, 'precio', t.precio,
    'direccion_turno', t.direccion, 'lat_turno', t.lat, 'lng_turno', t.lng,
    'puede_modificar', t.estado = 'confirmado'
        and t.inicio - make_interval(hours => b.horas_min_cancelacion) > now(),
    'horas_min_cancelacion', b.horas_min_cancelacion,
    'barberia', jsonb_build_object('nombre', b.nombre, 'slug', b.slug, 'timezone', b.timezone, 'color', b.color_marca, 'logo_path', b.logo_path,
        'direccion', case when t.modalidad = 'local' then b.direccion end,
        'lat', case when t.modalidad = 'local' then b.lat end,
        'lng', case when t.modalidad = 'local' then b.lng end))
  from turnos t join barberias b on b.id = t.barberia_id
  join servicios s on s.id = t.servicio_id join barberos x on x.id = t.barbero_id
  where t.gestion_token = p_token;
$$;

create or replace function public.crear_reserva(
  p_slug text, p_barbero uuid, p_servicio uuid, p_inicio timestamptz, p_modalidad text,
  p_nombre text, p_apellido text, p_telefono text, p_email text,
  p_direccion text default null, p_lat double precision default null, p_lng double precision default null,
  p_indicaciones text default null, p_consentimiento boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b barberias; v_fecha date; v_cliente uuid; v_turno turnos; v_email text; v_tel text;
begin
  select * into b from barberias where slug = p_slug;
  if not found then raise exception 'barberia_no_existe'; end if;
  if not p_consentimiento then raise exception 'falta_consentimiento'; end if;
  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_telefono), '') = '' or coalesce(trim(p_email), '') = ''
     or position('@' in p_email) = 0 then
    raise exception 'datos_invalidos';
  end if;
  if p_modalidad not in ('local','domicilio') or (b.modo <> 'ambos' and b.modo <> p_modalidad) then
    raise exception 'modalidad_no_disponible';
  end if;
  if p_modalidad = 'domicilio' then
    if p_lat is null or p_lng is null or coalesce(trim(p_direccion), '') = '' then
      raise exception 'direccion_requerida';
    end if;
    if b.radio_cobertura_km is not null and b.lat is not null
       and _distancia_km(b.lat, b.lng, p_lat, p_lng) > b.radio_cobertura_km then
      raise exception 'fuera_de_zona';
    end if;
  end if;

  v_fecha := (p_inicio at time zone b.timezone)::date;
  if not exists (select 1 from _slots(b.id, p_barbero, p_servicio, v_fecha, p_modalidad) s where s.slot = p_inicio) then
    raise exception 'horario_no_disponible';
  end if;

  v_email := lower(trim(p_email));
  select id into v_cliente from clientes where barberia_id = b.id and lower(email) = v_email;

  -- ficha cargada a mano por el barbero (sin mail): se reconoce por los últimos 8 dígitos del
  -- teléfono y se le agrega el mail. Si la ficha ya tiene otro mail, no se toca (evita secuestros).
  if v_cliente is null then
    v_tel := right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 8);
    if length(v_tel) = 8 then
      select id into v_cliente from clientes
        where barberia_id = b.id and email is null
          and right(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), 8) = v_tel
        order by created_at limit 1;
      if v_cliente is not null then
        update clientes set email = v_email where id = v_cliente;
      end if;
    end if;
  end if;

  if v_cliente is null then
    insert into clientes (barberia_id, nombre, apellido, telefono, email, direccion, lat, lng, consentimiento_at)
    values (b.id, trim(p_nombre), nullif(trim(p_apellido), ''), trim(p_telefono), v_email,
            case when p_modalidad = 'domicilio' then p_direccion end,
            case when p_modalidad = 'domicilio' then p_lat end,
            case when p_modalidad = 'domicilio' then p_lng end, now())
    returning id into v_cliente;
  else
    -- ficha existente: solo se completan los campos vacíos; lo que cargó el barbero no se pisa
    update clientes set
      apellido = coalesce(apellido, nullif(trim(p_apellido), '')),
      telefono = coalesce(telefono, nullif(trim(p_telefono), '')),
      direccion = case when direccion is null and p_modalidad = 'domicilio' then p_direccion else direccion end,
      lat = case when direccion is null and p_modalidad = 'domicilio' then p_lat else lat end,
      lng = case when direccion is null and p_modalidad = 'domicilio' then p_lng else lng end,
      consentimiento_at = coalesce(consentimiento_at, now())
    where id = v_cliente;
  end if;

  begin
    insert into turnos (barberia_id, barbero_id, cliente_id, servicio_id, inicio, fin, ocupa_hasta,
                        modalidad, direccion, lat, lng, indicaciones)
    values (b.id, p_barbero, v_cliente, p_servicio, p_inicio, p_inicio, p_inicio, p_modalidad,
            case when p_modalidad = 'domicilio' then p_direccion end,
            case when p_modalidad = 'domicilio' then p_lat end,
            case when p_modalidad = 'domicilio' then p_lng end,
            p_indicaciones)
    returning * into v_turno;
  exception when exclusion_violation then
    raise exception 'horario_no_disponible';
  end;

  return jsonb_build_object(
    'turno_id', v_turno.id, 'gestion_token', v_turno.gestion_token,
    'inicio', v_turno.inicio, 'fin', v_turno.fin, 'precio', v_turno.precio,
    'modalidad', v_turno.modalidad, 'direccion_turno', v_turno.direccion,
    'indicaciones', v_turno.indicaciones, 'lat_turno', v_turno.lat, 'lng_turno', v_turno.lng,
    'cliente', jsonb_build_object('nombre', trim(p_nombre), 'apellido', p_apellido,
                                  'telefono', p_telefono, 'email', v_email),
    'servicio', (select s.nombre from servicios s where s.id = p_servicio),
    'barbero', (select x.nombre from barberos x where x.id = p_barbero),
    'barberia', jsonb_build_object('nombre', b.nombre, 'slug', b.slug,
                  'direccion', case when p_modalidad = 'local' then b.direccion end,
                  'lat', case when p_modalidad = 'local' then b.lat end,
                  'lng', case when p_modalidad = 'local' then b.lng end,
                  'timezone', b.timezone, 'color', b.color_marca, 'logo_path', b.logo_path),
    'email_barbero', (select u.email from auth.users u where u.id = b.owner_id));
end $$;

create or replace function public.reclamar_recordatorios(p_tipo text, p_limite int default 50)
returns setof jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_tipo not in ('24h','2h') then raise exception 'tipo_invalido'; end if;
  return query
  with due as (
    select t.id from turnos t
    where t.estado = 'confirmado'
      and ((p_tipo = '24h' and t.recordatorio_24h_at is null
              and t.inicio <= now() + interval '24 hours' and t.inicio > now() + interval '3 hours'
              and t.agendado_at < t.inicio - interval '24 hours')
        or (p_tipo = '2h' and t.recordatorio_2h_at is null
              and t.inicio <= now() + interval '2 hours' and t.inicio > now()
              and t.agendado_at < t.inicio - interval '2 hours'))
    order by t.inicio limit p_limite
    for update skip locked),
  upd as (
    update turnos t set
      recordatorio_24h_at = case when p_tipo = '24h' then now() else t.recordatorio_24h_at end,
      recordatorio_2h_at  = case when p_tipo = '2h'  then now() else t.recordatorio_2h_at end
    from due where t.id = due.id returning t.*)
  select jsonb_build_object(
    'turno_id', u.id, 'tipo', p_tipo, 'inicio', u.inicio, 'modalidad', u.modalidad,
    'gestion_token', u.gestion_token, 'direccion_turno', u.direccion, 'lat_turno', u.lat, 'lng_turno', u.lng,
    'cliente_nombre', c.nombre, 'cliente_email', c.email,
    'servicio', s.nombre, 'barbero', x.nombre,
    'barberia', b.nombre, 'timezone', b.timezone, 'color', b.color_marca, 'logo_path', b.logo_path,
    'direccion_local', case when u.modalidad = 'local' then b.direccion end,
    'lat', case when u.modalidad = 'local' then b.lat end,
    'lng', case when u.modalidad = 'local' then b.lng end)
  from upd u join clientes c on c.id = u.cliente_id
  join servicios s on s.id = u.servicio_id join barberos x on x.id = u.barbero_id
  join barberias b on b.id = u.barberia_id;
end $$;

revoke all on function public.crear_reserva(text, uuid, uuid, timestamptz, text, text, text, text, text, text,
                       double precision, double precision, text, boolean) from public, anon, authenticated;
grant execute on function public.crear_reserva(text, uuid, uuid, timestamptz, text, text, text, text, text, text,
                       double precision, double precision, text, boolean) to service_role;

