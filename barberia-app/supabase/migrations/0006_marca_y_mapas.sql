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
