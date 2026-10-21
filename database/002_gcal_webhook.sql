-- =============================================================================
--  002 · Aviso de cambios de tareas → n8n (sincronización con Google Calendar)
--  Reemplaza al "Database Webhook" del panel de Supabase (NO configures ambos:
--  duplicarías los eventos). Usa pg_net, incluido en todos los proyectos Supabase.
--
--  Cómo usarlo (Supabase → SQL Editor):
--    1. Pegá y ejecutá este archivo completo.
--    2. Ejecutá esta línea con TU dominio y TU GCAL_SYNC_SECRET (el mismo que cargaste en n8n):
--         select fn_config_gcal_webhook('https://n8n.tudominio.com/webhook/gcal-sync', 'TU_GCAL_SYNC_SECRET');
-- =============================================================================

create extension if not exists pg_net with schema extensions;

-- Configuración privada (RLS sin políticas → solo service_role / postgres)
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);
alter table public.app_config enable row level security;

-- Guarda la URL de n8n y el secreto (se puede volver a ejecutar para cambiarlos)
create or replace function public.fn_config_gcal_webhook(p_url text, p_secret text) returns text
language sql security definer set search_path = public as $$
  insert into public.app_config (key, value) values
    ('gcal_webhook_url', p_url),
    ('gcal_webhook_secret', p_secret)
  on conflict (key) do update set value = excluded.value;
  select 'Aviso a n8n configurado: ' || p_url;
$$;
revoke execute on function public.fn_config_gcal_webhook(text, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.fn_config_gcal_webhook(text, text) from anon, authenticated;
  end if;
end $$;

-- Mismo payload que los Database Webhooks de Supabase: {type, table, schema, record, old_record}
create or replace function public.trg_tasks_gcal_webhook() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url    text;
  v_secret text;
begin
  select value into v_url    from public.app_config where key = 'gcal_webhook_url';
  select value into v_secret from public.app_config where key = 'gcal_webhook_secret';
  if v_url is null or v_url = '' then
    return null;
  end if;

  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object(
                 'type', tg_op,
                 'table', tg_table_name,
                 'schema', tg_table_schema,
                 'record',     case when tg_op = 'DELETE' then null else to_jsonb(new) end,
                 'old_record', case when tg_op = 'INSERT' then null else to_jsonb(old) end),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', v_secret),
    timeout_milliseconds := 5000
  );
  return null;
end $$;

revoke execute on function public.trg_tasks_gcal_webhook() from public;

drop trigger if exists tasks_gcal_webhook on public.tasks;
create trigger tasks_gcal_webhook
  after insert or update or delete on public.tasks
  for each row execute function public.trg_tasks_gcal_webhook();
