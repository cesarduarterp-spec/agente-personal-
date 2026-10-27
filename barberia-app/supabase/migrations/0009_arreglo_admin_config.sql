-- Arreglo: admin_config hacía un UPDATE sin WHERE y Supabase lo rechaza (pg_safeupdate),
-- lo que rompía la pantalla Admin > Plazos. Reemplaza la función conservando permisos.
create or replace function public.admin_config(p_cobro_activo boolean default null, p_dias_prueba int default null,
                                    p_dias_gracia int default null, p_precio_texto text default null,
                                    p_instrucciones text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c configuracion_cobro;
begin
  if not es_admin() then raise exception 'no_autorizado'; end if;
  update configuracion_cobro set cobro_activo = coalesce(p_cobro_activo, cobro_activo),
    dias_prueba = coalesce(p_dias_prueba, dias_prueba), dias_gracia = coalesce(p_dias_gracia, dias_gracia),
    -- null = no tocar; texto vacío = borrar
    precio_texto = case when p_precio_texto is null then precio_texto else nullif(trim(p_precio_texto), '') end,
    instrucciones_pago = case when p_instrucciones is null then instrucciones_pago else nullif(trim(p_instrucciones), '') end
  where id -- Supabase rechaza UPDATE sin WHERE (pg_safeupdate); la tabla tiene una sola fila (id = true)
  returning * into c;
  return to_jsonb(c);
end $$;

revoke all on function public.admin_config(boolean, int, int, text, text) from public, anon, authenticated;
grant execute on function public.admin_config(boolean, int, int, text, text) to authenticated;
