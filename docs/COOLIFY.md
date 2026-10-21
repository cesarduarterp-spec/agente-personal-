# Instalación en un servidor con Coolify

Esta guía **no toca** lo que ya tenés corriendo. Coolify (con Traefik) sigue manejando los puertos
80 y 443 y pone los dominios y el SSL. Nosotros solo agregamos 3 recursos nuevos dentro de Coolify.

> ⚠ No uses `scripts/instalar.sh` en este servidor: levanta su propio Caddy en 80/443.
> Igual, si lo corrés por error, se detiene solo sin tocar nada.

Tiempo estimado: 60–90 minutos.

---

## Paso 0 · Ver qué hay corriendo (antes de tocar nada)

1. En Coolify, mirá **Projects**: anotá qué proyectos y recursos existen.
2. Fijate que ningún recurso use ya los dominios `n8n.`, `ntfy.` o `app.` de tu dominio.
   Si ya tenés un n8n, avisame: podemos usar otro subdominio (por ejemplo `asistente.`).
3. Opcional, más completo: Coolify → **Servers** → tu servidor → **Terminal**, y ejecutá:
   ```bash
   docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
   ```
   Pasame el resultado si querés que lo revise antes de seguir.

Todo lo nuevo va a quedar dentro de un proyecto propio llamado **Asistente**.

## Paso 1 · DNS

En el panel de tu dominio creá 3 registros **A** hacia la IP del servidor:
`n8n.tudominio.com`, `ntfy.tudominio.com` y `app.tudominio.com`.
Si ya tenés un comodín (`*.tudominio.com`) apuntando al servidor, no hace falta.

## Paso 2 · Supabase (desde el navegador)

1. **SQL Editor → New query**: pegá todo `database/001_init.sql` → **Run**.
2. Nueva query: `insert into app_users (email) values ('tu-email@gmail.com');` → **Run**.
3. Nueva query: pegá todo `database/002_gcal_webhook.sql` → **Run**.
4. Nueva query, con tu dominio y el `GCAL_SYNC_SECRET` que vas a cargar en n8n (paso 4):
   ```sql
   select fn_config_gcal_webhook('https://n8n.tudominio.com/webhook/gcal-sync', 'TU_GCAL_SYNC_SECRET');
   ```
5. **Authentication → URL Configuration → Site URL** = `https://app.tudominio.com`.
6. **Authentication → Users → Invite user** con tu email.

## Paso 3 · ntfy (notificaciones push)

1. En Coolify → **Projects → + New project** → nombre `Asistente`.
2. **+ New resource** → tu repo de GitHub (si es privado, conectá antes la *GitHub App* en **Sources**).
   - Branch: `claude/voice-first-executive-assistant-d4s640` (o `main` si lo pasamos)
   - **Build Pack: Docker Compose**
   - **Base Directory:** `/coolify/ntfy` · **Docker Compose Location:** `/docker-compose.yml`
3. **Environment Variables:** `NTFY_HOST` = `ntfy.tudominio.com`
4. En el servicio `ntfy` → **Domains:** `https://ntfy.tudominio.com:80` → **Deploy**.
5. Cuando esté verde, en el recurso abrí **Terminal** → contenedor `ntfy` y ejecutá:
   ```bash
   ntfy user add --role=admin cesar      # te pide una contraseña: guardala
   ntfy token add cesar                  # copiá el token que empieza con tk_
   ```

## Paso 4 · n8n

1. En el proyecto `Asistente` → **+ New resource** → mismo repo y branch → **Docker Compose**.
   - **Base Directory:** `/coolify/n8n` · **Docker Compose Location:** `/docker-compose.yml`
2. **Environment Variables:** Coolify las lista solas. Completalas así:

| Variable | Qué poner |
|---|---|
| `N8N_HOST` | `n8n.tudominio.com` |
| `NTFY_HOST` | `ntfy.tudominio.com` |
| `APP_HOST` | `app.tudominio.com` |
| `N8N_DB_PASSWORD` | una contraseña larga inventada (40 caracteres, sin espacios) |
| `N8N_ENCRYPTION_KEY` | otra contraseña larga distinta. **No la cambies nunca después** |
| `TELEGRAM_BOT_TOKEN` | el token de @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | otra contraseña larga (solo letras y números) |
| `TELEGRAM_ALLOWED_CHAT_ID` | tu número de @userinfobot |
| `GEMINI_API_KEY` | de aistudio.google.com |
| `XAI_API_KEY` | de console.x.ai |
| `GROK_MODEL` | `grok-4.3` (el diagnóstico te dice si existe; si no, te muestra cuáles usar) |
| `FORZAR_GROK` | `false` (poné `true` solo para probar el respaldo) |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` (secreta) |
| `NTFY_TOKEN` | el `tk_…` del paso 3 |
| `NTFY_TOPIC` | `agenda-alertas` |
| `RESEND_API_KEY` | de resend.com |
| `BRIEFING_EMAIL_FROM` | `Asistente <asistente@tudominio.com>` (dominio verificado en Resend) |
| `BRIEFING_EMAIL_TO` | tu email |
| `GCAL_SYNC_SECRET` | otra contraseña larga, **la misma** que pusiste en el paso 2.4 |
| `USER_NAME` | `César` |

3. En el servicio `n8n` → **Domains:** `https://n8n.tudominio.com:5678` → **Deploy**.
4. Abrí `https://n8n.tudominio.com` y creá tu usuario administrador.
5. Importá los workflows: bajá de GitHub los 5 archivos de `n8n/workflows/` y en n8n:
   **Workflows → ⋯ → Import from File** (uno por uno).
6. **Google Calendar:**
   - En console.cloud.google.com: creá un proyecto, activá la **Google Calendar API** y creá
     **Credentials → OAuth client ID → Web application**.
   - Como *Authorized redirect URI* poné `https://n8n.tudominio.com/rest/oauth2-credential/callback`.
   - En n8n: **Credentials → New → Google Calendar OAuth2 API** → pegá Client ID y Secret →
     **Sign in with Google**.
   - Elegí esa credencial en los nodos `GCal ·` de los workflows **04** y **05**.
7. Activá los workflows **01 a 05** (interruptor *Active* / botón *Publish* arriba a la derecha).
8. Abrí el workflow **05 · Diagnóstico** → **Execute workflow**. Conecta el bot de Telegram y te
   manda por Telegram el resultado de cada conexión.

## Paso 5 · La app (PWA)

1. En el proyecto `Asistente` → **+ New resource** → mismo repo y branch.
   - **Build Pack: Dockerfile** · **Base Directory:** `/web` · **Port:** `3000`
2. **Environment Variables** (marcá **Build Variable / disponible en build** en las tres):
   - `NEXT_PUBLIC_SUPABASE_URL` = tu Project URL de Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la `anon` key (es pública, no la `service_role`)
   - `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` = nombre del bot sin `@`
3. **Domains:** `https://app.tudominio.com` → **Deploy**.

## Paso 6 · Celular

1. Abrí `https://app.tudominio.com` → poné tu email → abrí el link que te llega →
   menú **Compartir → Agregar a pantalla de inicio** (iPhone) o **Instalar app** (Android).
2. Instalá **ntfy** → **+** → *Use another server* → `https://ntfy.tudominio.com` → entrá con tu
   usuario y contraseña del paso 3 → suscribite al tema `agenda-alertas`.

## Paso 7 · Probar

| Qué mandar al bot | Qué tiene que pasar |
|---|---|
| `/diagnostico` | Un informe ✔/✘ de todas las conexiones, con el motivo de cada falla |
| Audio: *"mañana a las 10 llamar al proveedor de hormigón, es urgente"* | Tarea creada con botones; aparece en la app y en Calendar; aviso a las 9:45 |
| `/grok qué tengo mañana` | Responde Grok, con la nota *🧪 Prueba de respaldo* |

Para probar el respaldo con **audios**: poné `FORZAR_GROK=true` en n8n, hacé *Redeploy*, mandá un
audio, y después volvé a `false`.
