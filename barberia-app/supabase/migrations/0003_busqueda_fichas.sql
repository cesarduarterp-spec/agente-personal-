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
