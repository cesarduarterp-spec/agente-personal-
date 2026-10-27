-- Cobro manual en pesos: el precio y las instrucciones de pago (alias/CBU, link de Mercado Pago)
-- se configuran desde /admin y los ve cada barbero en "Mi plan". Y el filtro "por vencer" del admin.

alter table public.configuracion_cobro add column precio_texto text, add column instrucciones_pago text;

drop function public.admin_config(boolean, int, int);
create function public.admin_config(p_cobro_activo boolean default null, p_dias_prueba int default null,
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

create or replace function public.admin_usuarios(p_q text default '', p_filtro text default null, p_barberia uuid default null,
                                      p_limite int default 200)
returns setof jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'no_autorizado'; end if;
  return query
  select jsonb_build_object(
    'user_id', u.id, 'email', u.email, 'creado', u.created_at, 'ultimo_ingreso', u.last_sign_in_at,
    'confirmado', u.email_confirmed_at is not null,
    'barberia_id', b.id, 'nombre', b.nombre, 'slug', b.slug, 'modo', b.modo,
    'estado', coalesce(s.estado, case when b.id is null then 'sin_barberia' end),
    'prueba_hasta', s.prueba_hasta, 'periodo_hasta', s.periodo_hasta, 'proveedor', s.proveedor, 'notas', s.notas,
    'habilitada', case when b.id is null then null else barberia_habilitada(b.id) end,
    'turnos_30d', (select count(*) from turnos t where t.barberia_id = b.id and t.created_at > now() - interval '30 days'),
    'clientes', (select count(*) from clientes c where c.barberia_id = b.id),
    'pagado', coalesce((select jsonb_object_agg(moneda, total) from (
        select moneda, sum(monto) total from pagos p where p.barberia_id = b.id and p.estado = 'pagado' group by moneda) x), '{}'))
  from auth.users u
  left join barberias b on b.owner_id = u.id
  left join suscripciones s on s.barberia_id = b.id
  where (p_barberia is null or b.id = p_barberia)
    and (coalesce(trim(p_q), '') = '' or _norm(u.email) like '%' || _norm(trim(p_q)) || '%'
         or _norm(b.nombre) like '%' || _norm(trim(p_q)) || '%' or _norm(b.slug) like '%' || _norm(trim(p_q)) || '%')
    and (p_filtro is null or p_filtro = ''
         or (p_filtro = 'sin_barberia' and b.id is null)
         -- por vencer: la prueba o el pago termina en los próximos 7 días (a quién cobrarle)
         or (p_filtro = 'por_vencer' and ((s.estado = 'activa' and s.periodo_hasta between now() and now() + interval '7 days')
                                       or (s.estado = 'prueba' and s.prueba_hasta between now() and now() + interval '7 days')))
         or (p_filtro not in ('sin_barberia', 'por_vencer') and s.estado = p_filtro))
  order by u.created_at desc
  limit least(greatest(p_limite, 1), 1000);
end $$;

create or replace function public.mi_plan() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'barberia_id', b.id, 'estado', s.estado, 'prueba_hasta', s.prueba_hasta, 'periodo_hasta', s.periodo_hasta,
    'proveedor', s.proveedor, 'habilitada', barberia_habilitada(b.id),
    'cobro_activo', (select cobro_activo from configuracion_cobro),
    'precio_texto', (select precio_texto from configuracion_cobro), 'instrucciones_pago', (select instrucciones_pago from configuracion_cobro),
    'dias_gracia', (select dias_gracia from configuracion_cobro))
  from barberias b join suscripciones s on s.barberia_id = b.id
  where b.owner_id = auth.uid() order by b.created_at limit 1;
$$;

revoke all on function public.admin_config(boolean, int, int, text, text) from public, anon, authenticated;
grant execute on function public.admin_config(boolean, int, int, text, text) to authenticated;
