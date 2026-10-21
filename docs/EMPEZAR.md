# Empezar · Etapa 1 (lo esencial)

**Objetivo:** mandar un audio a Telegram, que se agende la tarea y que te llegue el recordatorio.
Calendar, email, la app del celular y las notificaciones extra quedan para la **etapa 2**.

Son 6 pasos. Hacé uno por vez y, si algo no coincide con lo que ves, mandá una captura de pantalla.

---

### Paso 1 · Crear el bot (Telegram, 3 min)
1. En Telegram buscá **@BotFather** → escribí `/newbot`.
2. Elegí un nombre (ej: *Mi Asistente*) y un usuario que termine en `bot` (ej: *cesar_agenda_bot*).
3. Te da un **token** (algo como `123456:ABC…`). **Copialo** a un bloc de notas.
4. Buscá **@userinfobot** → escribile algo → copiá el número que dice **Id**.

### Paso 2 · Clave de Gemini (2 min)
1. Entrá a **aistudio.google.com/apikey** con tu cuenta de Google.
2. **Create API key** → copiala al bloc de notas.

### Paso 3 · Supabase (5 min)
1. En GitHub abrí el archivo `database/001_init.sql` → botón **Copy raw file** (ícono de copiar).
2. En Supabase → **SQL Editor** → **New query** → pegá → **Run**. Tiene que decir *Success*.
3. En Supabase → **Project Settings → API**: copiá la **Project URL** y la clave **service_role**.

### Paso 4 · Subdominio (2 min)
En el panel de tu dominio creá un registro **A**: `n8n` → la IP de tu servidor.

### Paso 5 · n8n en Coolify (15 min)
1. Coolify → **Projects → + New** → nombre `Asistente`.
2. **+ New resource** → tu repositorio de GitHub → branch `claude/voice-first-executive-assistant-d4s640`.
3. **Build Pack:** *Docker Compose* · **Base Directory:** `/coolify/n8n`.
4. En **Environment Variables** completá solo estas 9 (las demás dejalas vacías):

| Variable | Qué poner |
|---|---|
| `N8N_HOST` | `n8n.tudominio.com` |
| `N8N_DB_PASSWORD` | una contraseña larga inventada, sin espacios |
| `N8N_ENCRYPTION_KEY` | otra contraseña larga distinta (no la cambies nunca) |
| `TELEGRAM_WEBHOOK_SECRET` | otra más, solo letras y números |
| `TELEGRAM_BOT_TOKEN` | el token del paso 1 |
| `TELEGRAM_ALLOWED_CHAT_ID` | tu Id del paso 1 |
| `GEMINI_API_KEY` | la clave del paso 2 |
| `SUPABASE_URL` | la Project URL del paso 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | la clave service_role del paso 3 |

5. En el servicio **n8n** → **Domains:** `https://n8n.tudominio.com:5678` → **Deploy**.

### Paso 6 · Encender y probar (10 min)
1. Abrí `https://n8n.tudominio.com` → creá tu usuario.
2. Bajá de GitHub estos 4 archivos de `n8n/workflows/`: **01**, **02**, **03** y **05**.
   En n8n: **Workflows → ⋯ → Import from File** (uno por uno).
3. Abrí el **05 · Diagnóstico** → **Execute workflow**. Te llega un mensaje por Telegram.
   Lo esencial tiene que salir con ✔. Lo opcional sale con ⏸ (es normal).
4. Activá los workflows **01, 02, 03 y 05** (interruptor arriba a la derecha).
5. Mandá un audio al bot: *"mañana a las 10 llamar al proveedor de hormigón"*.

✅ Si te responde confirmando la tarea, **la etapa 1 está lista.**

---

**Etapa 2 (cuando quieras):** respaldo Grok, app del celular, notificaciones ntfy, email del briefing y
Google Calendar → `docs/COOLIFY.md`.
