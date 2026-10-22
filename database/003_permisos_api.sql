-- =============================================================================
--  003 · Permisos para la Data API de Supabase
--  Los proyectos de Supabase creados desde 2026 ya no exponen automáticamente las
--  tablas y funciones nuevas: hay que dar permisos explícitos. Sin esto, n8n recibe
--  "404" al llamar a las funciones de la agenda.
--  Se puede ejecutar varias veces sin problema (Supabase → SQL Editor → Run).
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- n8n usa service_role: acceso completo a tablas, secuencias y funciones del asistente
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- La app del celular (usuario logueado): solo ver y actualizar sus tareas (RLS limita a tu email)
grant select, update on public.tasks to authenticated;
grant execute on function public.fn_task_action(uuid, text, text) to authenticated;
grant execute on function public.is_app_user() to authenticated;
grant execute on function public.task_json(public.tasks) to authenticated;
grant execute on function public.app_tz() to authenticated;

-- Que la Data API (PostgREST) relea las funciones nuevas ya mismo
notify pgrst, 'reload schema';

select 'Permisos de la Data API listos' as resultado;
