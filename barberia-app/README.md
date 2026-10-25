# Agenda para barberías

Reservas online sin registro para clientes, panel para barberos, recordatorios por mail y ficha de cada corte.

```
barberia-app/
├─ supabase/migrations/0001_init.sql   esquema, RLS, reservas, recordatorios, storage
├─ supabase/tests/                     pruebas del esquema (Postgres común + stubs de Supabase)
├─ web/                                Next.js (App Router) + Supabase Auth
└─ n8n/                                workflow que dispara los recordatorios cada 10 min
```

## Estado
- [x] Esquema multi-barbería con anti doble-reserva (constraint de exclusión), gestión por token, reclamo atómico de recordatorios
- [x] Login de barberos: mail + contraseña (con verificación), Google, recuperar contraseña
- [x] Onboarding (modo local / domicilio, servicios, horarios, autocompletado de Google Maps)
- [x] Reserva rápida del cliente sin cuenta (`/<slug>`), Turnstile, Google Maps, gestión por link (`/turno/<token>`), mails de confirmación con .ics
- [x] Fichas de clientes: se crean solas con los datos del turno, n° de ficha correlativo, buscador, orden alfabético por nombre, observaciones, historial de cortes con fotos
- [x] Horarios: días y franjas que habilita el barbero, intervalo entre turnos, días libres y vacaciones
- [x] Configuración: datos de la barbería, modo, zona y traslado, banner de promo, servicios y barberos (alta, edición, activar/desactivar)
- [x] Agenda: marcar turnos como realizado / no vino / cancelado (avisa al cliente por mail)
- [x] Fechas especiales abiertas fuera del horario semanal (los bloqueos siempre tienen prioridad)
- [x] Panel de administrador (`/admin`): usuarios, pagos, estado de cada barbería, cobro manual y configuración — ver `COBROS.md`
- [x] Planes y cobros: prueba gratis, estado del plan para el barbero, avisos de Lemon Squeezy (USD) con firma verificada
- [x] Reply-To: el cliente responde los mails y le llega al barbero (y al revés)
- [x] Cargar un turno a mano (cliente que llama o llega sin reservar), con aviso por mail opcional
- [x] Recordatorios por mail (24 h y 2 h antes) disparados por n8n — ver `n8n/README.md`

## Modelo de seguridad
- El rol `anon` no accede a ninguna tabla. Lo público sale de funciones `SECURITY DEFINER`.
- `crear_reserva` solo la ejecuta `service_role`: el servidor Next.js valida Turnstile y recién ahí la llama. Si estuviera abierta a `anon`, cualquiera se saltearía el captcha con la clave pública.
- Cancelar/reprogramar usa el `gestion_token` del mail y respeta `horas_min_cancelacion`.
- Un cliente que reserva con un mail ya existente se vincula a su ficha **sin sobrescribir** los datos cargados por el barbero.
- Fotos: bucket privado `cortes`, ruta `{barberia_id}/{cliente_id}/archivo`, solo el dueño accede.

## Probar el esquema localmente
Requiere un Postgres 14+ (sin Supabase):
```bash
createdb t && psql -d t -f supabase/tests/stubs.sql && psql -d t -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql -f supabase/migrations/0002_fichas_horarios.sql -f supabase/migrations/0003_busqueda_fichas.sql -f supabase/migrations/0004_aperturas.sql -f supabase/migrations/0005_turno_manual.sql -f supabase/migrations/0006_marca_y_mapas.sql -f supabase/migrations/0007_cobros_y_admin.sql -f supabase/migrations/0008_cobro_manual.sql
psql -d t -At -v ON_ERROR_STOP=1 -f supabase/tests/test.sql | grep -c "^f$"   # debe dar 0 (y verás los "=== ... OK ===")
```

## Puesta en marcha (cuentas tuyas)
1. **Supabase**: crear el proyecto y ejecutar en el SQL Editor, en orden, `0001_init.sql`, `0002_fichas_horarios.sql` y `0003_busqueda_fichas.sql`, `0004_aperturas.sql`, `0005_turno_manual.sql`, `0006_marca_y_mapas.sql`, `0007_cobros_y_admin.sql` y `0008_cobro_manual.sql`.
   - Authentication → Providers: activar **Email** (con *Confirm email*) y **Google**.
   - Authentication → URL Configuration: *Site URL* = tu dominio; *Redirect URLs* = `https://tudominio.com/auth/callback` (y `http://localhost:3000/auth/callback` para desarrollo).
2. **Google Cloud**:
   - Cliente OAuth (tipo Web) con el redirect de Supabase (`https://<proyecto>.supabase.co/auth/v1/callback`); cargar Client ID/Secret en Supabase.
   - Clave de **Maps** restringida por dominio (HTTP referrer) y a estas 4 APIs, que hay que **habilitar**: *Maps JavaScript API*, *Places API (New)*, *Geocoding API* y *Maps Embed API* (esta última, para el mapa de confirmación, no tiene costo por uso).
   - **Presupuesto con alertas** (Billing → Budgets & alerts) para enterarte si se pasa del cupo gratuito.
3. **Cloudflare Turnstile**: crear el widget y copiar site key / secret key.
4. **Resend**: verificar tu dominio y agregar los registros **SPF, DKIM y DMARC** en el DNS.
5. **Coolify (Hetzner)**: nueva app desde este repo, *Base Directory* `barberia-app/web`, build con Dockerfile, puerto 3000. Cargar las variables de `web/.env.example`; las `NEXT_PUBLIC_*` como *Build Variables*. `SUPABASE_SERVICE_ROLE_KEY` nunca con prefijo `NEXT_PUBLIC_`.
6. **n8n**: moverlo del Docker local al VPS, definir `CRON_SECRET` en la app e importar el workflow (`n8n/README.md`).
