-- =============================================================================
--  002 · Webhook de base de datos → n8n (sincronización con Google Calendar)
--  Reemplaza al "Database Webhook" del panel de Supabase (NO configures ambos:
--  duplicarías los eventos). Usa pg_net, incluido en todos los proyectos Supabase.
--
--  Ejecutar con psql pasando las variables:
--    psql "$SUPABASE_DB_URL" -v n8n_url='https://n8n.midominio.com/webhook/gcal-sync' \
--                            -v secret='<GCAL_SYNC_SECRET>' -f 002_gcal_webhook.sql
--  (scripts/instalar.sh lo hace solo)
-- =============================================================================

create extension if not exists pg_net with schema extensions;

-- Configuración privada (RLS sin políticas → solo service_role / postgres)
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);
alter table public.app_config enable row level security;

insert into public.app_config (key, value) values
  ('gcal_webhook_url', :'n8n_url'),
  ('gcal_webhook_secret', :'secret')
on conflict (key) do update set value = excluded.value;

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
