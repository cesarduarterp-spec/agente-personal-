-- Número de ficha por barbería (correlativo, a prueba de reservas simultáneas) y
-- guardado atómico de los horarios que habilita el barbero.

alter table public.barberias add column siguiente_ficha int not null default 1;
alter table public.clientes add column numero int;

-- fichas que ya existieran: numeración por orden de creación
with n as (
  select id, row_number() over (partition by barberia_id order by created_at, id) as rn from public.clientes
)
update public.clientes c set numero = n.rn from n where n.id = c.id;
update public.barberias b set siguiente_ficha =
  coalesce((select max(c.numero) + 1 from public.clientes c where c.barberia_id = b.id), 1);

alter table public.clientes alter column numero set not null;
create unique index clientes_numero_uk on public.clientes (barberia_id, numero);

-- asigna el número al crear la ficha (se ignora cualquier valor enviado por el cliente)
create function public._cliente_numero() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update barberias set siguiente_ficha = siguiente_ficha + 1
    where id = new.barberia_id returning siguiente_ficha - 1 into new.numero;
  if new.numero is null then raise exception 'barberia_no_existe'; end if;
  return new;
end $$;
create trigger cliente_numero before insert on public.clientes
  for each row execute function public._cliente_numero();

-- el número de ficha nunca cambia
create function public._cliente_numero_fijo() returns trigger
language plpgsql as $$
begin
  new.numero := old.numero;
  return new;
end $$;
create trigger cliente_numero_fijo before update on public.clientes
  for each row execute function public._cliente_numero_fijo();

-- el contador solo lo mueve el trigger de arriba (profundidad 2), no el dueño con un UPDATE directo
create function public._barberia_contador_fijo() returns trigger
language plpgsql as $$
begin
  if pg_trigger_depth() = 1 then new.siguiente_ficha := old.siguiente_ficha; end if;
  return new;
end $$;
create trigger barberia_contador_fijo before update on public.barberias
  for each row execute function public._barberia_contador_fijo();

revoke all on function public._cliente_numero(), public._cliente_numero_fijo(), public._barberia_contador_fijo()
  from public, anon, authenticated;

-- Reemplaza todos los horarios de un barbero en una sola transacción.
-- SECURITY INVOKER: las políticas RLS siguen decidiendo si el barbero es del usuario.
create function public.guardar_horarios(p_barbero uuid, p_horarios jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  delete from horarios where barbero_id = p_barbero;
  insert into horarios (barbero_id, dia_semana, desde, hasta)
  select p_barbero, (x->>'dia_semana')::int, (x->>'desde')::time, (x->>'hasta')::time
  from jsonb_array_elements(p_horarios) x;
  if exists (
    select 1 from horarios a join horarios b
      on a.barbero_id = b.barbero_id and a.dia_semana = b.dia_semana and a.id < b.id
     and a.desde < b.hasta and b.desde < a.hasta
    where a.barbero_id = p_barbero) then
    raise exception 'horarios_superpuestos';
  end if;
end $$;
revoke all on function public.guardar_horarios(uuid, jsonb) from public, anon;
grant execute on function public.guardar_horarios(uuid, jsonb) to authenticated;

-- Bloquea días (vacaciones, feriados) o franjas horarias en la zona horaria de la barbería.
-- Devuelve cuántos turnos confirmados ya reservados caen en el período, para avisarle al barbero.
create function public.bloquear_dias(p_barbero uuid, p_desde date, p_hasta date,
                                     p_hora_desde time default null, p_hora_hasta time default null,
                                     p_motivo text default null) returns int
language plpgsql security invoker set search_path = public as $$
declare tz text; v_ini timestamptz; v_fin timestamptz; v_conflictos int;
begin
  select ba.timezone into tz from barberos b join barberias ba on ba.id = b.barberia_id where b.id = p_barbero;
  if tz is null then raise exception 'barbero_no_existe'; end if;
  if p_hasta < p_desde then raise exception 'rango_invalido'; end if;
  v_ini := (p_desde + coalesce(p_hora_desde, time '00:00')) at time zone tz;
  v_fin := case when p_hora_hasta is null then ((p_hasta + 1)::timestamp) at time zone tz
                else (p_hasta + p_hora_hasta) at time zone tz end;
  if v_fin <= v_ini then raise exception 'rango_invalido'; end if;
  insert into bloqueos (barbero_id, inicio, fin, motivo) values (p_barbero, v_ini, v_fin, p_motivo);
  select count(*) into v_conflictos from turnos
    where barbero_id = p_barbero and estado = 'confirmado' and tstzrange(inicio, fin) && tstzrange(v_ini, v_fin);
  return v_conflictos;
end $$;
revoke all on function public.bloquear_dias(uuid, date, date, time, time, text) from public, anon;
grant execute on function public.bloquear_dias(uuid, date, date, time, time, text) to authenticated;
