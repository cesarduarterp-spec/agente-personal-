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
