# Estado del proyecto · Asistente Ejecutivo Voice-First

Rama: `claude/voice-first-executive-assistant-d4s640`.

## ✅ Hecho (código terminado y probado)

| Parte | Qué hace | Cómo se probó |
|---|---|---|
| **Base de datos** (`database/001_init.sql`) | Tabla `tasks`, categorías, prioridades, estados. Funciones para crear, completar por parecido de texto, reprogramar en cadena, posponer, recordatorios sin duplicados, briefing y sync con Calendar. Solo tu email ve los datos. Cambios en vivo (Realtime). | Ejecutado 2 veces en PostgreSQL 16 local con roles de Supabase simulados |
| **Webhook tareas → n8n** (`database/002_gcal_webhook.sql`) | Avisa a n8n de cada alta, cambio o baja de tarea, para sincronizar Google Calendar | Probado en Postgres local con `pg_net` simulado |
| **Servidor** (`infra/`) | Docker Compose con Caddy (SSL automático), n8n + su base, ntfy y la app | Configuración validada con `docker compose config` |
| **Agente de Telegram** (workflow 01) | Notas de voz y texto. Gemini 2.5 Flash escucha el audio directo y usa 7 herramientas. Botones ✅ Lista / ⏳ +1 h / 📅 Mañana. Solo responde a tu chat. | 11 escenarios con Telegram/Gemini/Grok simulados contra la base real |
| **Respaldo Grok** | Si Gemini falla (tras 1 reintento): el audio se transcribe con xAI y Grok resuelve con las mismas herramientas, sin repetir lo ya hecho | Cubierto por las mismas pruebas (caída total, caída a mitad de camino, todo caído) |
| **Recordatorios** (workflow 02) | Cada 5 min: avisa por Telegram con botones; si es prioridad alta, también push por ntfy | Probado: no manda duplicados |
| **Briefing 08:00** (workflow 03) | Tareas del día y atrasadas + clima de San Luis + resumen escrito por IA, por Telegram y email | Probado, incluso con Gemini y el clima caídos |
| **Google Calendar** (workflow 04) | Sincronización en los dos sentidos, sin bucles | Probado el filtro anti-bucle y la lógica SQL |
| **App (PWA)** (`web/`) | Vistas Hoy / Semana / Mes, filtros por categoría, deslizar para completar o posponer, actualización en vivo, instalable en el celular | Compila sin errores; revisada con capturas en celular, escritorio y modo oscuro |
| **Instalador** (`scripts/instalar.sh`) | Hace casi toda la puesta en marcha en el VPS | Sintaxis + shellcheck + pruebas del manejo del `.env` |
| **Búsqueda web** | Eliminada, según lo pedido | — |

## ⚠️ No probado todavía (se prueba al instalar)

- Llamadas reales a Telegram, Gemini, Grok, Supabase, Resend, ntfy y Google Calendar: hasta ahora todo fue con simulaciones.
- Importar los workflows en un n8n real y que corran tal cual.
- El instalador corriendo en un VPS real.
- El modelo de Grok `grok-4.3` (sacado del SDK oficial de xAI; se cambia en `GROK_MODEL` si no existe).

## 📋 Falta hacer (vos)

### Antes de instalar
1. Conseguir las claves:
   - Bot de Telegram (@BotFather), Gemini (aistudio.google.com), xAI (console.x.ai), Resend.
   - Supabase: URL, anon key, service_role key y connection string (**Connect → Session pooler**).
2. Crear en tu dominio 3 registros A hacia la IP del VPS: `n8n.`, `ntfy.` y `app.`.

### Instalar (en el VPS)
3. Clonar el repo y correr `sudo bash scripts/instalar.sh` (ver `docs/SETUP.md`).

### Después del instalador (una sola vez, ~15 min)
4. Crear tu usuario administrador en `https://n8n.tudominio.com`.
5. En Supabase, poner el *Site URL* = `https://app.tudominio.com`.
6. Google Calendar: crear la credencial OAuth en Google Cloud, cargarla en n8n y activar el workflow 04.
7. Verificar el dominio del remitente en Resend.
8. En el celular: instalar la app ("Agregar a pantalla de inicio") y la app ntfy.

### Prueba final
9. Mandar un audio: *"Mañana a las 10 llamar al proveedor de hormigón, es urgente"*.
   - Tiene que aparecer en la app, en Calendar y avisarte a las 9:45.

## 💡 Opcional / a futuro
- Pasar la rama a `main` del repo.
- Ajustes cuando lo uses unos días: tono del asistente, horario del briefing, minutos de aviso por defecto (hoy 15).
