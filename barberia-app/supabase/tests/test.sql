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

-- 8. fichas numeradas y horarios atómicos
select array_agg(numero order by numero) = array[1,2] as fichas_numeradas from clientes where barberia_id = :'barberia';
update clientes set numero = 99 where email = 'pedro@x.com';
select numero = 1 as numero_inmutable from clientes where email = 'pedro@x.com';
set request.jwt.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
insert into clientes (barberia_id, nombre, numero) values (:'barberia', 'Ana', 500);
update barberias set siguiente_ficha = 1 where id = :'barberia';
insert into clientes (barberia_id, nombre) values (:'barberia', 'Beto');
select string_agg(nombre || '#' || numero, ',' order by numero) as fichas from clientes;
select pg_temp.expect_error(format($q$select guardar_horarios('%s', '[{"dia_semana":1,"desde":"09:00","hasta":"13:00"},{"dia_semana":1,"desde":"12:00","hasta":"18:00"}]')$q$, :'barbero'), 'horarios_superpuestos');
select count(*) = 7 as horarios_intactos_tras_error from horarios where barbero_id = :'barbero';
select guardar_horarios(:'barbero', '[{"dia_semana":1,"desde":"09:00","hasta":"13:00"},{"dia_semana":1,"desde":"15:00","hasta":"19:00"}]');
select count(*) = 2 as horarios_reemplazados from horarios where barbero_id = :'barbero';
reset role;
set request.jwt.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select pg_temp.expect_error(format($q$select guardar_horarios('%s', '[{"dia_semana":2,"desde":"09:00","hasta":"10:00"}]')$q$, :'barbero'), 'row-level security');
reset role;
\echo === FICHAS OK ===

-- 9. bloqueos: un día bloqueado no ofrece horarios y avisa de turnos ya reservados
set request.jwt.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select guardar_horarios(:'barbero', '[{"dia_semana":0,"desde":"09:00","hasta":"18:00"},{"dia_semana":1,"desde":"09:00","hasta":"18:00"},{"dia_semana":2,"desde":"09:00","hasta":"18:00"},{"dia_semana":3,"desde":"09:00","hasta":"18:00"},{"dia_semana":4,"desde":"09:00","hasta":"18:00"},{"dia_semana":5,"desde":"09:00","hasta":"18:00"},{"dia_semana":6,"desde":"09:00","hasta":"18:00"}]');
select count(*) > 0 as dia_con_horarios from disponibilidad('juan-barber', :'barbero', :'servicio', :'dia'::date);
select bloquear_dias(:'barbero', :'dia'::date, :'dia'::date, null, null, 'vacaciones') as turnos_en_conflicto;
select count(*) = 0 as dia_bloqueado_sin_horarios from disponibilidad('juan-barber', :'barbero', :'servicio', :'dia'::date);
select pg_temp.expect_error(format($q$select bloquear_dias('%s', '%s', '%s')$q$, :'barbero', :'dia', ('2000-01-01')), 'rango_invalido');
reset role;
set request.jwt.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select pg_temp.expect_error(format($q$select bloquear_dias('%s', '%s', '%s')$q$, :'barbero', :'dia', :'dia'), 'barbero_no_existe');
reset role;
\echo === BLOQUEOS OK ===

-- 10. búsqueda de fichas: nombre+apellido, sin tildes, por n° y orden alfabético
set request.jwt.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
insert into clientes (barberia_id, nombre, apellido, telefono) values
  (:'barberia', 'Juan', 'Pérez', '11 4444-0000'), (:'barberia', 'Álvaro', 'Núñez', null), (:'barberia', 'Zoe', 'Pérez', null);
select count(*) = 1 as busca_nombre_y_apellido from buscar_clientes('juan perez');
select count(*) = 1 as busca_con_mayusculas from buscar_clientes('JUAN PÉ');
select count(*) = 2 as busca_solo_apellido from buscar_clientes('perez');
select count(*) = 1 as busca_sin_tilde from buscar_clientes('nunez');
select count(*) = 1 as busca_por_telefono from buscar_clientes('4444');
select (select count(*) from buscar_clientes('#' || (select numero from clientes where nombre = 'Zoe'))) >= 1 as busca_por_numero;
select count(*) = 0 as sin_resultados from buscar_clientes('nadie zzz');
select count(*) = 0 as comodin_escapado from buscar_clientes('%');
select array_agg(nombre order by ord) = array['Álvaro','Ana','Beto','Cerca','Juan','Pedro (editado)','Zoe'] as orden_alfabetico
  from (select nombre, row_number() over () ord from buscar_clientes('')) z;
reset role;
set request.jwt.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select count(*) = 0 as busqueda_aislada_por_barberia from buscar_clientes('');
reset role;

-- 11. la ficha se completa con los datos del turno; no se duplican fichas cargadas a mano
select (:'dia'::date + 5 + time '12:00') at time zone 'America/Argentina/Buenos_Aires' as r12 \gset
select (:'dia'::date + 5 + time '12:30') at time zone 'America/Argentina/Buenos_Aires' as r1230 \gset
select (:'dia'::date + 5 + time '13:00') at time zone 'America/Argentina/Buenos_Aires' as r13 \gset
select (:'dia'::date + 5 + time '13:30') at time zone 'America/Argentina/Buenos_Aires' as r1330 \gset
set request.jwt.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
insert into clientes (barberia_id, nombre, apellido, telefono) values (:'barberia', 'Luis', 'Rojas', '11 5555-1234');
insert into clientes (barberia_id, nombre, email, observaciones) values (:'barberia', 'Mara', 'mara@x.com', 'nota del barbero');
reset role;
select count(*) as fichas_antes from clientes where barberia_id = :'barberia' \gset
set role service_role;
-- Luis reserva online con su teléfono en otro formato y un mail: es la misma ficha
select crear_reserva('juan-barber', :'barbero', :'servicio', :'r12', 'local', 'Luis','Rojas','+54 9 11 5555 1234','Luis@X.com',null,null,null,null,true) is not null as reserva_luis;
-- Mara (con mail) reserva a domicilio: se completa teléfono y dirección, no se pisa nada
select crear_reserva('juan-barber', :'barbero', :'servicio', :'r1230', 'domicilio', 'MARA CAMBIADA','Gomez','11 2222-3333','mara@x.com','Cerca 2',-34.61,-58.39,null,true) is not null as reserva_mara;
-- alguien con el mismo teléfono pero OTRO mail no secuestra la ficha de Luis (ya tiene mail)
select crear_reserva('juan-barber', :'barbero', :'servicio', :'r1330', 'local', 'Impostor','X','1155551234','impostor@x.com',null,null,null,null,true) is not null as reserva_impostor;
reset role;
select count(*) = :fichas_antes + 1 as solo_una_ficha_nueva from clientes where barberia_id = :'barberia';
select email = 'luis@x.com' and nombre = 'Luis' as luis_reutilizada from clientes where telefono = '11 5555-1234';
select nombre = 'Mara' and telefono = '11 2222-3333' and apellido = 'Gomez' and direccion = 'Cerca 2' and observaciones = 'nota del barbero' as mara_completada_sin_pisar
  from clientes where email = 'mara@x.com';
select count(*) = 1 as impostor_tiene_su_ficha from clientes where email = 'impostor@x.com' and nombre = 'Impostor';
\echo === BUSQUEDA OK ===
