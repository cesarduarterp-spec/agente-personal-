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
