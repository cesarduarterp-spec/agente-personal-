# Puesta en marcha (VPS Ubuntu + Docker)

## 1. DNS
Creá registros **A** apuntando a la IP del VPS:
`n8n.midominio.com`, `ntfy.midominio.com`, `app.midominio.com`.
Caddy emite los certificados SSL solo (puertos 80/443 abiertos en el firewall).

## 2. Cuentas y claves
| Servicio | Qué necesitás |
|---|---|
| Telegram | Bot con **@BotFather** → token. Tu `chat_id`: escribile a **@userinfobot**. |
| Gemini | API key en Google AI Studio. |
| Supabase | URL, `anon` key y `service_role` key (Project Settings → API). |
| Resend | API key y un dominio verificado para el remitente. |
| Google Calendar | Credencial OAuth2 (se carga dentro de n8n, paso 6). |

## 3. Base de datos
**A · Supabase Cloud (recomendado).**
1. SQL Editor → pegá y ejecutá `database/001_init.sql`.
2. Ejecutá también: `insert into app_users (email) values ('tu-email@dominio.com');`
3. Authentication → URL Configuration → *Site URL* = `https://app.midominio.com`.
4. Authentication → Users → **Invite user** con ese mismo email. La PWA usa `shouldCreateUser: false`, así que nadie más se puede registrar.

**B · Supabase self-hosted.** Usá el stack oficial (`git clone https://github.com/supabase/supabase && cd supabase/docker`), levantalo en el mismo VPS, agregá un bloque `supabase.{$DOMAIN}` al `Caddyfile` apuntando a Kong (`:8000`) y seguí los mismos pasos 1–4 desde Studio.

## 4. Levantar el stack
```bash
git clone <este-repo> asistente && cd asistente/infra
cp .env.example .env && nano .env         # completar todo
openssl rand -hex 32                      # → N8N_ENCRYPTION_KEY, secrets, etc.
docker compose up -d --build
```

### Usuario y token de ntfy
```bash
docker compose exec ntfy ntfy user add --role=admin cesar
docker compose exec ntfy ntfy token add cesar            # → NTFY_TOKEN en .env
docker compose up -d n8n                                  # recarga variables
```
En el celular: app **ntfy** → servidor `https://ntfy.midominio.com` → login → suscribirse al topic `NTFY_TOPIC`.

## 5. Importar los workflows en n8n
```bash
docker compose exec n8n n8n import:workflow --separate --input=/workflows
```
(o desde la UI: *Import from file*). Activá los 4 workflows.

## 6. Credencial de Google Calendar
En n8n: *Credentials → New → Google Calendar OAuth2 API*, y seleccionala en los 4 nodos HTTP `GCal ·` del workflow 04.

## 7. Conectar Telegram al webhook
```bash
source .env
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://n8n.$DOMAIN/webhook/telegram" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
  -d 'allowed_updates=["message","callback_query"]'
```

## 8. Database Webhook de Supabase (sync → Google Calendar)
Supabase → Database → Webhooks → *Create*:
- Tabla `tasks`, eventos **Insert, Update, Delete**
- Tipo HTTP POST → `https://n8n.midominio.com/webhook/gcal-sync`
- Header `x-sync-secret: <GCAL_SYNC_SECRET>`

## 9. Instalar la PWA
Abrí `https://app.midominio.com` en el celular → link mágico → **Agregar a pantalla de inicio**.

## Prueba de humo
1. Mandá un audio al bot: *"Mañana a las 10 recordame llamar al proveedor de hormigón, es urgente"*.
2. La tarea aparece **en vivo** en la PWA (punto verde = Realtime conectado).
3. Decí *"ya llamé al proveedor"* → se tilda sola en la pantalla.
4. A las 09:45 llega el recordatorio con botones + push de ntfy (prioridad alta).

## Desarrollo local
```bash
node scripts/build-n8n.mjs        # regenera n8n/workflows/*.json desde n8n/src
cd web && cp .env.example .env.local && npm i && npm run dev
```
