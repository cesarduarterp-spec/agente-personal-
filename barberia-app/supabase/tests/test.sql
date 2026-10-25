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

-- 12. aperturas: abrir una fecha fuera del horario semanal; un bloqueo le gana
select (:'dia'::date + 10) as d10 \gset
select extract(dow from :'d10'::date)::int as dow10 \gset
set request.jwt.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select guardar_horarios(:'barbero', (select jsonb_agg(jsonb_build_object('dia_semana', d, 'desde', '09:00', 'hasta', '18:00')) from generate_series(0,6) d where d <> :dow10));
select count(*) = 0 as fecha_cerrada_sin_apertura from disponibilidad('juan-barber', :'barbero', :'servicio', :'d10'::date);
select abrir_fecha(:'barbero', :'d10'::date, '10:00', '12:00', 'domingo extra') as bloqueos_superpuestos;
select count(*) = 4 as fecha_abierta_4_horarios from disponibilidad('juan-barber', :'barbero', :'servicio', :'d10'::date);
select pg_temp.expect_error(format($q$select abrir_fecha('%s', '%s', '12:00', '10:00')$q$, :'barbero', :'d10'), 'rango_invalido');
select bloquear_dias(:'barbero', :'d10'::date, :'d10'::date, null, null, 'feriado') as aviso;
select count(*) = 0 as bloqueo_le_gana_a_apertura from disponibilidad('juan-barber', :'barbero', :'servicio', :'d10'::date);
reset role;
set request.jwt.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select pg_temp.expect_error(format($q$select abrir_fecha('%s', '%s', '10:00', '12:00')$q$, :'barbero', :'d10'), 'barbero_no_existe');
select count(*) = 0 as aperturas_aisladas from aperturas;
reset role;
\echo === APERTURAS OK ===

-- 13. turno manual: fuera de horario permitido, superposición rechazada, aislado por barbería
select (:'dia'::date + 20) as d20 \gset
select id as cliente_pedro from clientes where email = 'pedro@x.com' \gset
set request.jwt.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select (crear_turno_manual(:'barbero', :'servicio', :'cliente_pedro', :'d20'::date, '22:00', 'local') ->> 'turno_id') is not null as manual_fuera_de_horario;
select pg_temp.expect_error(format($q$select crear_turno_manual('%s','%s','%s','%s','22:15','local')$q$, :'barbero', :'servicio', :'cliente_pedro', :'d20'), 'horario_no_disponible');
select pg_temp.expect_error(format($q$select crear_turno_manual('%s','%s','%s','%s','10:00','domicilio')$q$, :'barbero', :'servicio', :'cliente_pedro', :'d20'), 'direccion_requerida');
select (crear_turno_manual(:'barbero', :'servicio', :'cliente_pedro', :'d20'::date, '22:30', 'local') ->> 'turno_id') is not null as manual_contiguo_ok;
reset role;
select (inicio at time zone 'America/Argentina/Buenos_Aires')::time = '22:00' as hora_local_correcta from turnos where inicio = (:'d20'::date + time '22:00') at time zone 'America/Argentina/Buenos_Aires';
set request.jwt.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select pg_temp.expect_error(format($q$select crear_turno_manual('%s','%s','%s','%s','09:00','local')$q$, :'barbero', :'servicio', :'cliente_pedro', :'d20'), 'barbero_no_existe');
reset role;
\echo === MANUAL OK ===

-- 14. marca y coordenadas del domicilio
set request.jwt.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
update barberias set color_marca = '#b45309', logo_path = :'barberia' || '/logo.png' where id = :'barberia';
select pg_temp.expect_error(format($q$update barberias set color_marca = 'rojo' where id = '%s'$q$, :'barberia'), 'barberias_color_marca_check');
reset role;
set role anon;
select (perfil_publico('juan-barber') ->> 'color') = '#b45309' and (perfil_publico('juan-barber') ->> 'logo_path') like '%/logo.png' as perfil_con_marca;
reset role;
select (:'dia'::date + 8 + time '12:00') at time zone 'America/Argentina/Buenos_Aires' as m12 \gset
set role service_role;
select (crear_reserva('juan-barber', :'barbero', :'servicio', :'m12', 'domicilio', 'Geo','Test','11 9999-0000','geo@x.com','Cerca 9',-34.61,-58.39,null,true) ->> 'lat_turno')::float = -34.61 as reserva_devuelve_coordenadas;
reset role;
update turnos set inicio = now() + interval '20 hours', fin = now() + interval '20 hours 30 minutes', ocupa_hasta = now() + interval '20 hours 50 minutes', agendado_at = now() - interval '2 days'
  where cliente_id = (select id from clientes where email = 'geo@x.com');
set role service_role;
select (select count(*) from reclamar_recordatorios('24h') r where (r ->> 'lat_turno')::float = -34.61 and r ->> 'color' = '#b45309') = 1 as recordatorio_con_coordenadas_y_color;
reset role;
\echo === MARCA OK ===

-- 15. cobros: el dueño no puede escribir su estado de suscripción ni sus pagos
select count(*) = 1 as trial_creado_por_trigger from suscripciones where barberia_id = :'barberia' and estado = 'prueba';
set request.jwt.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select count(*) = 1 as dueno_ve_su_suscripcion from suscripciones;
select pg_temp.expect_error(format($q$update suscripciones set estado = 'activa' where barberia_id = '%s'$q$, :'barberia'), 'permission denied');
select pg_temp.expect_error(format($q$insert into pagos (barberia_id, monto, moneda) values ('%s', 1, 'USD')$q$, :'barberia'), 'permission denied');
select pg_temp.expect_error($q$select * from administradores$q$, 'permission denied');
select pg_temp.expect_error($q$select admin_resumen()$q$, 'no_autorizado');
select pg_temp.expect_error($q$select admin_usuarios()$q$, 'no_autorizado');
select pg_temp.expect_error(format($q$select admin_registrar_pago('%s', 1, 'USD', 'x', 'x', 1)$q$, :'barberia'), 'no_autorizado');
select es_admin() = false as dueno_no_es_admin;
reset role;
set request.jwt.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select count(*) = 1 as otro_dueno_solo_su_suscripcion from suscripciones;
reset role;

-- 16. admin: ve a todos (incluidos los que no armaron su barbería), cobra a mano, suspende
insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999', 'admin@x.com'), ('88888888-8888-8888-8888-888888888888', 'abandono@x.com');
insert into administradores (user_id) values ('99999999-9999-9999-9999-999999999999');
set request.jwt.sub = '99999999-9999-9999-9999-999999999999';
set role authenticated;
select es_admin() as admin_reconocido;
select (admin_resumen() ->> 'sin_barberia')::int >= 2 as resumen_cuenta_sin_barberia;
select count(*) >= 4 as admin_ve_a_todos from admin_usuarios();
select count(*) = 1 as admin_ve_al_que_abandono from admin_usuarios('abandono', 'sin_barberia');
select count(*) = 1 as admin_busca_por_slug from admin_usuarios('juan-barber');
select admin_registrar_pago(:'barberia', 15, 'USD', 'transferencia', 'pago de prueba', 1) ->> 'ok' as pago_registrado;
select pg_temp.expect_error(format($q$select admin_registrar_pago('%s', 15, 'USD', 'x', 'x', 0)$q$, :'barberia'), 'meses_invalidos');
select (admin_pagos() -> 0 ->> 'monto')::numeric = 15 as admin_ve_pago;
select admin_extender_prueba(:'barberia', 10) ->> 'ok' as prueba_extendida;
reset role;
select estado = 'prueba' as extender_vuelve_a_prueba from suscripciones where barberia_id = :'barberia';

-- 17. habilitación: el cobro está apagado por defecto; suspendida siempre bloquea; vencida solo con cobro activo
select (:'dia'::date + 12 + time '15:00') at time zone 'America/Argentina/Buenos_Aires' as h15 \gset
select barberia_habilitada(:'barberia') as habilitada_con_cobro_apagado;
set request.jwt.sub = '99999999-9999-9999-9999-999999999999';
set role authenticated;
select admin_cambiar_estado(:'barberia', 'suspendida', 'abuso') ->> 'ok' as suspendida;
reset role;
select barberia_habilitada(:'barberia') = false as suspendida_bloquea;
set role anon;
select (perfil_publico('juan-barber') ->> 'habilitada')::boolean = false as perfil_informa_inactiva;
reset role;
set role service_role;
select pg_temp.expect_error(format($q$select crear_reserva('juan-barber', '%s', '%s', '%s', 'local', 'X','Y','1','z@z.com',null,null,null,null,true)$q$, :'barbero', :'servicio', :'h15'), 'barberia_inactiva');
reset role;
set request.jwt.sub = '99999999-9999-9999-9999-999999999999';
set role authenticated;
select admin_cambiar_estado(:'barberia', 'prueba') ->> 'ok' as reactivada;
select (admin_config(true) ->> 'cobro_activo')::boolean as cobro_activado;
reset role;
update suscripciones set prueba_hasta = now() - interval '1 day' where barberia_id = :'barberia';
select barberia_habilitada(:'barberia') = false as prueba_vencida_bloquea_con_cobro_activo;
set request.jwt.sub = '99999999-9999-9999-9999-999999999999';
set role authenticated;
select admin_registrar_pago(:'barberia', 15, 'USD', 'transferencia', null, 1) ->> 'ok' as cobrado;
select admin_config(false) ->> 'cobro_activo' as cobro_apagado_otra_vez;
reset role;
select barberia_habilitada(:'barberia') as habilitada_tras_pago;

-- 18. eventos del proveedor: idempotentes, sin retroceder fechas ni pisar suspensiones
select periodo_hasta as ph_actual from suscripciones where barberia_id = :'barberia' \gset
set role service_role;
select (registrar_evento_cobro('lemonsqueezy', 'evt1', 'subscription_payment_success', :'barberia', 'activa', now() + interval '60 days', 'cli1', 'sub1', 'pay1', 15, 'USD') ->> 'duplicado') is null as evento_nuevo;
select (registrar_evento_cobro('lemonsqueezy', 'evt1', 'subscription_payment_success', :'barberia', 'activa', now() + interval '60 days', 'cli1', 'sub1', 'pay1', 15, 'USD') ->> 'duplicado')::boolean as evento_duplicado_ignorado;
select registrar_evento_cobro('lemonsqueezy', 'evt0', 'subscription_updated', :'barberia', 'activa', now() + interval '1 day', null, 'sub1') ->> 'ok' as evento_atrasado;
reset role;
select count(*) = 1 as un_solo_pago_del_proveedor from pagos where proveedor = 'lemonsqueezy';
select periodo_hasta > now() + interval '55 days' as fecha_no_retrocede from suscripciones where barberia_id = :'barberia';
update suscripciones set estado = 'suspendida' where barberia_id = :'barberia';
set role service_role;
select registrar_evento_cobro('lemonsqueezy', 'evt2', 'subscription_updated', :'barberia', 'activa', now() + interval '90 days', null, 'sub1') ->> 'ok' as evento_sobre_suspendida;
reset role;
select estado = 'suspendida' as suspension_del_admin_se_respeta from suscripciones where barberia_id = :'barberia';
update suscripciones set estado = 'activa' where barberia_id = :'barberia';

-- 19. recordatorios incluyen el mail del barbero (para Reply-To)
select (:'dia'::date + 14 + time '10:00') at time zone 'America/Argentina/Buenos_Aires' as h10 \gset
set role service_role;
select (crear_reserva('juan-barber', :'barbero', :'servicio', :'h10', 'local', 'Rep','Ly','11 3333-0000','reply@x.com',null,null,null,null,true) ->> 'email_barbero') = 'duenio1@x.com' as reserva_trae_mail_del_barbero;
reset role;
update turnos set inicio = now() + interval '23 hours', fin = now() + interval '23 hours 30 minutes', ocupa_hasta = now() + interval '23 hours 30 minutes', agendado_at = now() - interval '2 days'
  where cliente_id = (select id from clientes where email = 'reply@x.com');
set role service_role;
select (select count(*) from reclamar_recordatorios('24h') r where r ->> 'email_barbero' = 'duenio1@x.com') = 1 as recordatorio_trae_mail_del_barbero;
reset role;
\echo === COBROS OK ===

-- 20. mi_plan (lo que ve el dueño) y avisos sin dato propio
set request.jwt.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select (mi_plan() ->> 'estado') is not null and (mi_plan() ->> 'cobro_activo') = 'false' as mi_plan_propio;
reset role;
set request.jwt.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select (mi_plan() ->> 'barberia_id') <> :'barberia' as mi_plan_no_mezcla_barberias;
reset role;
set role service_role;
select registrar_evento_cobro('lemonsqueezy', 'evt3', 'subscription_payment_success', null, 'activa', now() + interval '120 days', null, 'sub1', 'pay2', 15, 'USD') ->> 'ok' as aviso_resuelto_por_suscripcion;
select pg_temp.expect_error($q$select registrar_evento_cobro('lemonsqueezy', 'evt4', 'x', null, 'activa', now(), null, 'sub-desconocida')$q$, 'barberia_no_existe');
reset role;
select count(*) = 2 as dos_pagos_del_proveedor from pagos where proveedor = 'lemonsqueezy';
\echo === PLAN OK ===

-- 21. cobro manual: precio e instrucciones configurables, filtro "por vencer"
set request.jwt.sub = '99999999-9999-9999-9999-999999999999';
set role authenticated;
select (admin_config(null, null, null, 'ARS 20.000 por mes', E'Alias: wameta.cobros\nMandá el comprobante') ->> 'precio_texto') = 'ARS 20.000 por mes' as precio_guardado;
select (admin_config() ->> 'instrucciones_pago') like 'Alias: wameta.cobros%' and (admin_config() ->> 'precio_texto') is not null as config_se_conserva_si_no_se_toca;
select pg_temp.expect_error($q$select admin_config(true, 400)$q$, 'dias_prueba_check');
reset role;
set request.jwt.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select (mi_plan() ->> 'precio_texto') = 'ARS 20.000 por mes' and (mi_plan() ->> 'instrucciones_pago') like '%comprobante%' as barbero_ve_instrucciones;
select pg_temp.expect_error($q$select admin_config(null, null, null, 'x', 'y')$q$, 'no_autorizado');
reset role;
update suscripciones set estado = 'activa', periodo_hasta = now() + interval '3 days' where barberia_id = :'barberia';
set request.jwt.sub = '99999999-9999-9999-9999-999999999999';
set role authenticated;
select count(*) = 1 as por_vencer_encuentra_la_que_vence_en_3_dias from admin_usuarios('', 'por_vencer');
select count(*) >= 1 and bool_and((x ->> 'estado') = 'activa') as filtro_activa_sigue_andando from admin_usuarios('', 'activa') x;
reset role;
update suscripciones set periodo_hasta = now() + interval '40 days' where barberia_id = :'barberia';
set request.jwt.sub = '99999999-9999-9999-9999-999999999999';
set role authenticated;
select count(*) = 0 as por_vencer_ignora_la_que_vence_en_40_dias from admin_usuarios('', 'por_vencer');
select admin_config(false, null, null, '', '') is not null as config_se_puede_borrar;
reset role;
select precio_texto is null and instrucciones_pago is null as config_borrada from configuracion_cobro;
\echo === MANUAL-COBRO OK ===
