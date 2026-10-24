-- Cobros y administración.
--  * Estado de suscripción y pagos en tablas aparte: el dueño de la barbería solo puede LEERLAS.
--    (Si el estado viviera en "barberias", cualquier barbero podría ponerse "activo" a sí mismo.)
--  * Rol de administrador a nivel de base de datos: todas las funciones admin_* lo verifican.
--  * Cobro desactivado por defecto: no corta ninguna barbería hasta que el admin lo active.
--
-- Para crear el primer administrador (una sola vez, con TU mail):
--   insert into public.administradores (user_id) select id from auth.users where email = 'tu@mail.com';

create table public.administradores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creado_at timestamptz not null default now()
);
alter table public.administradores enable row level security; -- sin policies: nadie la lee directo
revoke all on public.administradores from anon, authenticated;

create table public.configuracion_cobro (
  id boolean primary key default true check (id), -- una sola fila
  cobro_activo boolean not null default false,
  dias_prueba int not null default 30 check (dias_prueba between 0 and 365),
  dias_gracia int not null default 7 check (dias_gracia between 0 and 90)
);
insert into public.configuracion_cobro default values;
alter table public.configuracion_cobro enable row level security;
revoke all on public.configuracion_cobro from anon, authenticated;

create function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from administradores where user_id = auth.uid());
$$;

create table public.suscripciones (
  id uuid primary key default gen_random_uuid(),
  barberia_id uuid not null unique references public.barberias(id) on delete cascade,
  estado text not null default 'prueba' check (estado in ('prueba','activa','vencida','suspendida','cancelada')),
  plan text not null default 'mensual',
  proveedor text not null default 'manual' check (proveedor in ('manual','lemonsqueezy','mercadopago')),
  proveedor_cliente_id text,
  proveedor_suscripcion_id text,
  prueba_hasta timestamptz,
  periodo_hasta timestamptz,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index suscripciones_prov_uk on public.suscripciones (proveedor, proveedor_suscripcion_id)
  where proveedor_suscripcion_id is not null;

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  barberia_id uuid not null references public.barberias(id) on delete cascade,
  proveedor text not null default 'manual',
  proveedor_pago_id text,
  monto numeric not null check (monto >= 0),
  moneda text not null check (moneda in ('USD','ARS')),
  estado text not null default 'pagado' check (estado in ('pagado','reembolsado','fallido')),
  metodo text,
  nota text,
  periodo_hasta timestamptz,
  fecha timestamptz not null default now()
);
create unique index pagos_prov_uk on public.pagos (proveedor, proveedor_pago_id) where proveedor_pago_id is not null;
create index on public.pagos (barberia_id, fecha desc);

-- eventos recibidos del proveedor: evita procesar dos veces el mismo aviso
create table public.eventos_cobro (
  proveedor text not null,
  evento_id text not null,
  tipo text,
  recibido_at timestamptz not null default now(),
  primary key (proveedor, evento_id)
);
alter table public.eventos_cobro enable row level security;
revoke all on public.eventos_cobro from anon, authenticated;

alter table public.suscripciones enable row level security;
alter table public.pagos enable row level security;
-- el dueño solo LEE lo suyo; no hay policies de escritura
create policy suscripciones_leer on public.suscripciones for select to authenticated using (public.es_dueno(barberia_id));
create policy pagos_leer on public.pagos for select to authenticated using (public.es_dueno(barberia_id));
revoke all on public.suscripciones, public.pagos from anon, authenticated;
grant select on public.suscripciones, public.pagos to authenticated;

-- toda barbería nueva arranca con prueba gratis
create function public._suscripcion_inicial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into suscripciones (barberia_id, estado, prueba_hasta)
  values (new.id, 'prueba', now() + make_interval(days => (select dias_prueba from configuracion_cobro)));
  return new;
end $$;
create trigger suscripcion_inicial after insert on public.barberias
  for each row execute function public._suscripcion_inicial();

-- barberías que ya existían (incluida la del piloto): prueba desde hoy
insert into public.suscripciones (barberia_id, estado, prueba_hasta)
select b.id, 'prueba', now() + make_interval(days => (select dias_prueba from public.configuracion_cobro))
from public.barberias b where not exists (select 1 from public.suscripciones s where s.barberia_id = b.id);

-- ¿puede recibir reservas? Suspendida: siempre no. El resto, solo si el admin activó el cobro.
create function public.barberia_habilitada(p_barberia uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when s.id is null then true
    when s.estado = 'suspendida' then false
    when not (select cobro_activo from configuracion_cobro) then true
    when s.estado = 'prueba' then coalesce(s.prueba_hasta, now()) > now()
    when s.estado in ('activa','cancelada') then
      coalesce(s.periodo_hasta, now()) + make_interval(days => (select dias_gracia from configuracion_cobro)) > now()
    else false end
  from (select 1) x left join suscripciones s on s.barberia_id = p_barberia;
$$;

-- Estado del plan del propio dueño (no puede leer la configuración global directamente).
create function public.mi_plan() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'barberia_id', b.id, 'estado', s.estado, 'prueba_hasta', s.prueba_hasta, 'periodo_hasta', s.periodo_hasta,
    'proveedor', s.proveedor, 'habilitada', barberia_habilitada(b.id),
    'cobro_activo', (select cobro_activo from configuracion_cobro),
    'dias_gracia', (select dias_gracia from configuracion_cobro))
  from barberias b join suscripciones s on s.barberia_id = b.id
  where b.owner_id = auth.uid() order by b.created_at limit 1;
$$;

-- ---------------------------------------------------------------- funciones de administración

create function public.admin_resumen() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'no_autorizado'; end if;
  return jsonb_build_object(
    'usuarios', (select count(*) from auth.users),
    'con_barberia', (select count(distinct owner_id) from barberias),
    'sin_barberia', (select count(*) from auth.users u where not exists (select 1 from barberias b where b.owner_id = u.id)),
    'en_prueba', (select count(*) from suscripciones where estado = 'prueba'),
    'activas', (select count(*) from suscripciones where estado = 'activa'),
    'vencidas', (select count(*) from suscripciones where estado in ('vencida','cancelada')),
    'suspendidas', (select count(*) from suscripciones where estado = 'suspendida'),
    'turnos_30d', (select count(*) from turnos where created_at > now() - interval '30 days'),
    'ingresos_30d', coalesce((select jsonb_object_agg(moneda, total) from (
        select moneda, sum(monto) total from pagos where estado = 'pagado' and fecha > now() - interval '30 days' group by moneda) x), '{}'),
    'ingresos_total', coalesce((select jsonb_object_agg(moneda, total) from (
        select moneda, sum(monto) total from pagos where estado = 'pagado' group by moneda) x), '{}'),
    'cobro_activo', (select cobro_activo from configuracion_cobro));
end $$;

-- Parte de auth.users (no de barberias): así se ven también los que se registraron y no armaron su barbería.
create function public.admin_usuarios(p_q text default '', p_filtro text default null, p_barberia uuid default null,
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
         or (p_filtro <> 'sin_barberia' and s.estado = p_filtro))
  order by u.created_at desc
  limit least(greatest(p_limite, 1), 1000);
end $$;

create function public.admin_pagos(p_barberia uuid default null, p_limite int default 200)
returns setof jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'no_autorizado'; end if;
  return query
  select jsonb_build_object('id', p.id, 'fecha', p.fecha, 'barberia_id', b.id, 'barberia', b.nombre,
    'email', (select u.email from auth.users u where u.id = b.owner_id),
    'monto', p.monto, 'moneda', p.moneda, 'estado', p.estado, 'proveedor', p.proveedor,
    'metodo', p.metodo, 'nota', p.nota, 'periodo_hasta', p.periodo_hasta)
  from pagos p join barberias b on b.id = p.barberia_id
  where p_barberia is null or p.barberia_id = p_barberia
  order by p.fecha desc limit least(greatest(p_limite, 1), 1000);
end $$;

-- cobro manual (transferencia, Mercado Pago, efectivo): registra el pago y activa por N meses
create function public.admin_registrar_pago(p_barberia uuid, p_monto numeric, p_moneda text, p_metodo text,
                                            p_nota text, p_meses int default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_hasta timestamptz;
begin
  if not es_admin() then raise exception 'no_autorizado'; end if;
  if p_meses < 1 or p_meses > 24 then raise exception 'meses_invalidos'; end if;
  select greatest(coalesce(periodo_hasta, now()), now()) + make_interval(months => p_meses) into v_hasta
    from suscripciones where barberia_id = p_barberia for update;
  if not found then raise exception 'barberia_no_existe'; end if;
  insert into pagos (barberia_id, proveedor, monto, moneda, metodo, nota, periodo_hasta)
    values (p_barberia, 'manual', p_monto, p_moneda, nullif(trim(p_metodo), ''), nullif(trim(p_nota), ''), v_hasta);
  update suscripciones set estado = 'activa', periodo_hasta = v_hasta, updated_at = now() where barberia_id = p_barberia;
  return jsonb_build_object('ok', true, 'periodo_hasta', v_hasta);
end $$;

create function public.admin_extender_prueba(p_barberia uuid, p_dias int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_hasta timestamptz;
begin
  if not es_admin() then raise exception 'no_autorizado'; end if;
  if p_dias < 1 or p_dias > 365 then raise exception 'dias_invalidos'; end if;
  update suscripciones set estado = 'prueba', prueba_hasta = greatest(coalesce(prueba_hasta, now()), now()) + make_interval(days => p_dias),
    updated_at = now() where barberia_id = p_barberia returning prueba_hasta into v_hasta;
  if not found then raise exception 'barberia_no_existe'; end if;
  return jsonb_build_object('ok', true, 'prueba_hasta', v_hasta);
end $$;

create function public.admin_cambiar_estado(p_barberia uuid, p_estado text, p_nota text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'no_autorizado'; end if;
  if p_estado not in ('prueba','activa','vencida','suspendida','cancelada') then raise exception 'estado_invalido'; end if;
  update suscripciones set estado = p_estado, notas = coalesce(nullif(trim(p_nota), ''), notas), updated_at = now()
    where barberia_id = p_barberia;
  if not found then raise exception 'barberia_no_existe'; end if;
  return jsonb_build_object('ok', true);
end $$;

create function public.admin_config(p_cobro_activo boolean default null, p_dias_prueba int default null,
                                    p_dias_gracia int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c configuracion_cobro;
begin
  if not es_admin() then raise exception 'no_autorizado'; end if;
  update configuracion_cobro set cobro_activo = coalesce(p_cobro_activo, cobro_activo),
    dias_prueba = coalesce(p_dias_prueba, dias_prueba), dias_gracia = coalesce(p_dias_gracia, dias_gracia)
  returning * into c;
  return to_jsonb(c);
end $$;

-- Estado de cobro que informa un proveedor (webhook). Solo service_role.
-- Idempotente: un mismo aviso (proveedor + evento_id) se procesa una sola vez.
create function public.registrar_evento_cobro(
  p_proveedor text, p_evento_id text, p_tipo text, p_barberia uuid, p_estado text,
  p_periodo_hasta timestamptz, p_cliente_id text, p_suscripcion_id text,
  p_pago_id text default null, p_monto numeric default null, p_moneda text default null,
  p_pago_estado text default 'pagado') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int; v_barberia uuid;
begin
  insert into eventos_cobro (proveedor, evento_id, tipo) values (p_proveedor, p_evento_id, p_tipo)
    on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('ok', true, 'duplicado', true); end if;
  if p_estado is not null and p_estado not in ('prueba','activa','vencida','suspendida','cancelada') then
    raise exception 'estado_invalido';
  end if;
  -- algunos avisos (ej. cobros) no traen nuestro dato propio: se resuelve por el id de suscripción del proveedor
  v_barberia := coalesce(p_barberia, (select barberia_id from suscripciones
                  where proveedor = p_proveedor and proveedor_suscripcion_id = p_suscripcion_id));
  if v_barberia is null then raise exception 'barberia_no_existe'; end if;
  update suscripciones set
    -- una suspensión decidida por el admin no se pisa con un aviso del proveedor
    estado = case when estado = 'suspendida' then estado else coalesce(p_estado, estado) end,
    proveedor = p_proveedor,
    proveedor_cliente_id = coalesce(p_cliente_id, proveedor_cliente_id),
    proveedor_suscripcion_id = coalesce(p_suscripcion_id, proveedor_suscripcion_id),
    -- fechas: nunca se retrocede el período por un aviso atrasado
    periodo_hasta = greatest(periodo_hasta, p_periodo_hasta),
    updated_at = now()
  where barberia_id = v_barberia;
  if not found then raise exception 'barberia_no_existe'; end if;
  if p_pago_id is not null and p_monto is not null then
    insert into pagos (barberia_id, proveedor, proveedor_pago_id, monto, moneda, estado, metodo, periodo_hasta)
    values (v_barberia, p_proveedor, p_pago_id, p_monto, p_moneda, coalesce(p_pago_estado, 'pagado'), p_proveedor, p_periodo_hasta)
    on conflict (proveedor, proveedor_pago_id) where proveedor_pago_id is not null
      do update set estado = excluded.estado;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- nuevas versiones de funciones existentes

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
    'timezone', b.timezone, 'color', b.color_marca, 'habilitada', public.barberia_habilitada(b.id), 'logo_path', b.logo_path,
    'barberos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre) order by x.nombre)
                          from barberos x where x.barberia_id = b.id and x.activo), '[]'),
    'servicios', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre,
                              'precio', s.precio, 'duracion_min', s.duracion_min) order by s.nombre)
                          from servicios s where s.barberia_id = b.id and s.activo), '[]'))
  from barberias b where b.slug = p_slug;
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
  if not public.barberia_habilitada(b.id) then raise exception 'barberia_inactiva'; end if;
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
    'email_barbero', (select au.email from auth.users au where au.id = b.owner_id), 'barberia', b.nombre, 'timezone', b.timezone, 'color', b.color_marca, 'logo_path', b.logo_path,
    'direccion_local', case when u.modalidad = 'local' then b.direccion end,
    'lat', case when u.modalidad = 'local' then b.lat end,
    'lng', case when u.modalidad = 'local' then b.lng end)
  from upd u join clientes c on c.id = u.cliente_id
  join servicios s on s.id = u.servicio_id join barberos x on x.id = u.barbero_id
  join barberias b on b.id = u.barberia_id;
end $$;

-- ---------------------------------------------------------------- permisos
revoke all on function
  public.es_admin(), public.mi_plan(), public.barberia_habilitada(uuid), public._suscripcion_inicial(),
  public.admin_resumen(), public.admin_usuarios(text, text, uuid, int), public.admin_pagos(uuid, int),
  public.admin_registrar_pago(uuid, numeric, text, text, text, int), public.admin_extender_prueba(uuid, int),
  public.admin_cambiar_estado(uuid, text, text), public.admin_config(boolean, int, int),
  public.registrar_evento_cobro(text, text, text, uuid, text, timestamptz, text, text, text, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.es_admin(), public.mi_plan() to authenticated;
grant execute on function
  public.admin_resumen(), public.admin_usuarios(text, text, uuid, int), public.admin_pagos(uuid, int),
  public.admin_registrar_pago(uuid, numeric, text, text, text, int), public.admin_extender_prueba(uuid, int),
  public.admin_cambiar_estado(uuid, text, text), public.admin_config(boolean, int, int)
  to authenticated;  -- cada una verifica es_admin() adentro
grant execute on function public.registrar_evento_cobro(text, text, text, uuid, text, timestamptz, text, text, text, numeric, text, text)
  to service_role;
-- perfil_publico y reclamar_recordatorios conservan sus permisos al reemplazarse; crear_reserva se re-declara:
revoke all on function public.crear_reserva(text, uuid, uuid, timestamptz, text, text, text, text, text, text,
                       double precision, double precision, text, boolean) from public, anon, authenticated;
grant execute on function public.crear_reserva(text, uuid, uuid, timestamptz, text, text, text, text, text, text,
                       double precision, double precision, text, boolean) to service_role;
