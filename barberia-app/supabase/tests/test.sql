\set ON_ERROR_STOP on
\set QUIET on
create function pg_temp.expect_error(q text, frag text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if sqlerrm like '%'||frag||'%' then raise notice 'OK  error esperado (%): %', frag, sqlerrm; return; end if;
    raise exception 'FAIL: error inesperado: %', sqlerrm;
  end;
  raise exception 'FAIL: no falló (esperaba %): %', frag, q;
end $$;

insert into auth.users (id,email) values ('11111111-1111-1111-1111-111111111111','duenio1@x.com'),('22222222-2222-2222-2222-222222222222','duenio2@x.com');
set request.jwt.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
insert into barberias (owner_id, slug, nombre, modo, direccion, lat, lng, radio_cobertura_km, buffer_traslado_min, recargo_traslado)
  values ('11111111-1111-1111-1111-111111111111','juan-barber','Juan Barber','ambos','Calle 1',-34.60,-58.38,5,30,1000);
insert into servicios (barberia_id, nombre, precio, duracion_min) select id,'Corte',10000,30 from barberias;
insert into horarios (barbero_id, dia_semana, desde, hasta) select x.id, d, '09:00','18:00' from barberos x, generate_series(0,6) d;
reset role;
set request.jwt.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
insert into barberias (owner_id, slug, nombre) values ('22222222-2222-2222-2222-222222222222','otra-barberia','Otra');
reset role;

-- fechas: mañana
select b.id as barberia, x.id as barbero, s.id as servicio from barberias b join barberos x on x.barberia_id=b.id join servicios s on s.barberia_id=b.id where b.slug='juan-barber' \gset
select ((now() at time zone 'America/Argentina/Buenos_Aires')::date + 2) as dia \gset
select (:'dia'::date + time '10:00') at time zone 'America/Argentina/Buenos_Aires' as t10 \gset
select (:'dia'::date + time '10:30') at time zone 'America/Argentina/Buenos_Aires' as t1030 \gset
select (:'dia'::date + time '11:00') at time zone 'America/Argentina/Buenos_Aires' as t11 \gset

-- 1. anon no puede leer tablas ni ejecutar crear_reserva
set role anon;
select pg_temp.expect_error('select * from clientes', 'permission denied');
select pg_temp.expect_error('select * from turnos', 'permission denied');
select pg_temp.expect_error($q$select crear_reserva('juan-barber', '$q$||:'barbero'||$q$', '$q$||:'servicio'||$q$', now(), 'local', 'a','b','1','a@b.com')$q$, 'permission denied');
select jsonb_array_length(perfil_publico('juan-barber')->'servicios') as servicios_publicos;
reset role;

-- 2. reserva OK + solape rechazado + cancelado libera
set role service_role;
select crear_reserva('juan-barber', :'barbero', :'servicio', :'t10', 'local', 'Pedro','Gómez','111','pedro@x.com',null,null,null,null,true)->>'gestion_token' as tok1 \gset
select pg_temp.expect_error(format($q$select crear_reserva('juan-barber','%s','%s','%s','local','Otro','X','222','otro@x.com',null,null,null,null,true)$q$, :'barbero', :'servicio', :'t10'), 'horario_no_disponible');
select pg_temp.expect_error(format($q$select crear_reserva('juan-barber','%s','%s','%s','local','Sin','Consent','222','sc@x.com',null,null,null,null,false)$q$, :'barbero', :'servicio', :'t1030'), 'falta_consentimiento');
reset role;
-- solape directo a nivel tabla (la constraint se sostiene aunque se salte la app)
select pg_temp.expect_error(format($q$insert into turnos (barberia_id,barbero_id,cliente_id,servicio_id,inicio,fin,ocupa_hasta,modalidad)
  select barberia_id,barbero_id,cliente_id,servicio_id,inicio+interval '10 minutes',inicio,inicio,modalidad from turnos limit 1$q$), 'turnos_sin_solape');
select count(*) = 0 as slot_10_libre from disponibilidad('juan-barber', :'barbero', :'servicio', :'dia'::date) s where s = :'t10'::timestamptz;
set role anon;
select cancelar_turno(:'tok1') ->> 'ok' as cancelado;
select count(*) = 1 as slot_10_liberado from disponibilidad('juan-barber', :'barbero', :'servicio', :'dia'::date) s where s = :'t10'::timestamptz;
reset role;

-- 3. cliente existente por email: no se pisan datos editados por el barbero
update clientes set nombre='Pedro (editado)', observaciones='degradé 2' where email='pedro@x.com';
set role service_role;
select crear_reserva('juan-barber', :'barbero', :'servicio', :'t11', 'local', 'HACKER','HACKER','999','PEDRO@x.com',null,null,null,null,true) is not null as reserva_ok;
reset role;
select nombre = 'Pedro (editado)' and observaciones = 'degradé 2' and telefono = '111' as ficha_intacta,
       (select count(*) from clientes where email='pedro@x.com') = 1 as sin_duplicado from clientes where email='pedro@x.com';

-- 4. domicilio: fuera de zona rechazado, dentro ok con buffer de traslado
set role service_role;
select pg_temp.expect_error(format($q$select crear_reserva('juan-barber','%s','%s','%s','domicilio','Lejos','X','1','lejos@x.com','Lejana 1',-35.5,-58.5,null,true)$q$, :'barbero', :'servicio', :'t1030'), 'fuera_de_zona');
select (select dia from (select (:'dia'::date + time '14:00') at time zone 'America/Argentina/Buenos_Aires' dia) z) as t14 \gset
select crear_reserva('juan-barber', :'barbero', :'servicio', :'t14', 'domicilio', 'Cerca','X','1','cerca@x.com','Cerca 1',-34.61,-58.39,'timbre 3',true)->>'precio' as precio_domicilio;
reset role;
select (ocupa_hasta - fin) = interval '30 minutes' as buffer_ok from turnos where modalidad='domicilio';
-- 14:30 está dentro del buffer del turno a domicilio: no debe ofrecerse
select count(*) = 0 as slot_en_buffer_oculto from disponibilidad('juan-barber', :'barbero', :'servicio', :'dia'::date) s
  where s = ((:'dia'::date + time '14:30') at time zone 'America/Argentina/Buenos_Aires');

-- 5. aislamiento entre barberías
set request.jwt.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select count(*) = 0 as otro_dueno_no_ve_clientes from clientes;
select count(*) = 0 as otro_dueno_no_ve_turnos from turnos;
select pg_temp.expect_error(format($q$insert into servicios (barberia_id,nombre,duracion_min) values ('%s','x',30)$q$, :'barberia'), 'row-level security');
reset role;
set request.jwt.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select count(*) = 2 as dueno_ve_sus_2_clientes from clientes;
reset role;

-- 6. recordatorios: reclamo atómico (segunda llamada no devuelve lo ya reclamado)
update turnos set inicio = now() + interval '20 hours', agendado_at = now() - interval '2 days', ocupa_hasta = now() + interval '20 hours 30 minutes', fin = now() + interval '20 hours 30 minutes' where modalidad='local' and estado='confirmado';
set role service_role;
select count(*) as reclamados_1 from reclamar_recordatorios('24h');
select count(*) as reclamados_2 from reclamar_recordatorios('24h');
reset role;
\echo === TODO OK ===

-- 7. gestión por token: ver, reprogramar (respeta ocupados y plazo), cancelar
update turnos set inicio = now() + interval '48 hours' where estado='confirmado' and modalidad='local' and cliente_id = (select id from clientes where email='pedro@x.com');
select gestion_token as tok2 from turnos where estado='confirmado' and cliente_id = (select id from clientes where email='pedro@x.com') limit 1 \gset
set role anon;
select (ver_turno(:'tok2')->>'puede_modificar')::boolean as puede_modificar_48h;
select pg_temp.expect_error(format($q$select reprogramar_turno('%s', '%s')$q$, :'tok2', :'t14'), 'horario_no_disponible');
select (reprogramar_turno(:'tok2', :'t1030'::timestamptz + interval '2 days') ->> 'ok')::boolean as reprogramado;
reset role;
update turnos set inicio = now() + interval '1 hour' where gestion_token = :'tok2';
set role anon;
select (ver_turno(:'tok2')->>'puede_modificar')::boolean = false as no_modificable_1h;
select pg_temp.expect_error(format($q$select cancelar_turno('%s')$q$, :'tok2'), 'fuera_de_plazo');
reset role;
\echo === GESTION OK ===
