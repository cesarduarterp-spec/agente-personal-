# Estado del proyecto · Asistente Ejecutivo Voice-First

Rama: `claude/voice-first-executive-assistant-d4s640` · Última revisión: adaptación a Coolify.

## ✅ Hecho (código terminado y probado sin servicios reales)

| Parte | Qué hace | Cómo se probó |
|---|---|---|
| **Base de datos** (`database/001_init.sql`) | Tareas, categorías, prioridades y estados. Completar por parecido de texto, reprogramar en cadena, posponer, recordatorios sin duplicados, briefing y sync con Calendar. Solo tu email ve los datos. Cambios en vivo. | PostgreSQL 16 local con roles de Supabase simulados |
| **Aviso de cambios → n8n** (`database/002_gcal_webhook.sql`) | Avisa a n8n de cada cambio de tarea (para Google Calendar). Se pega directo en el SQL Editor de Supabase. | Probado con `pg_net` simulado |
| **Instalación con Coolify** (`coolify/`, `docs/COOLIFY.md`) | n8n y ntfy como recursos de Coolify y la app desde GitHub. No abren puertos (Traefik pone dominios y SSL). Claves en las *Environment Variables* de Coolify. | Configuración validada: 0 puertos publicados; no arranca si falta una clave obligatoria |
| **Freno de seguridad** (`scripts/instalar.sh`) | El instalador viejo se detiene solo si detecta Coolify/Traefik o los puertos 80/443 ocupados | Probado simulando el puerto 443 ocupado |
| **Agente de Telegram** (workflow 01) | Voz y texto con Gemini 2.5 Flash (escucha el audio directo), 7 herramientas y botones ✅ / ⏳ / 📅 | 15 escenarios con Telegram/Gemini/Grok simulados contra la base real |
| **Respaldo Grok** | Si Gemini falla: transcribe el audio con xAI y responde Grok sin repetir lo ya hecho | Incluido en las pruebas |
| **Probar el respaldo a propósito** | `/grok …` en Telegram, o `FORZAR_GROK=true` en n8n (también audios) | Probado |
| **Diagnóstico** (workflow 05, `/diagnostico`) | Prueba cada conexión real y manda el informe ✔/✘ con el motivo por Telegram. Conecta el bot. Verifica que el modelo de Grok exista y lista los disponibles. | Probado con servicios simulados, incluidos los casos de error |
| **Recordatorios / Briefing / Google Calendar** (workflows 02–04) | Avisos cada 5 min (+ ntfy si es urgente), resumen a las 08:00 por Telegram y email, sync de ida y vuelta con Calendar | Probado |
| **Categorías** | `#Constructora`, `#AgenciaViajes`, `#ConsultoraIA`, `#Estudio`, `#Personal` escritas igual en base, herramientas, Gemini, Grok y app | Prueba automática que falla si alguna difiere |
| **Zona horaria** | Todo en `America/Argentina/Buenos_Aires`. Las fechas se guardan con zona. *"Mañana a las 10"* → aviso 09:45. | Probado en la base |
| **App (PWA)** | Hoy / Semana / Mes, filtros, deslizar para completar/posponer, en vivo, instalable | Compila; revisada en celular, escritorio y modo oscuro |
| **iPhone** | La vibración no existe en Safari: ya no se intenta y aparece un aviso visual ("✓ Completada", "📅 Pasada a mañana") | Probado simulando un iPhone sin vibración |
| **Seguridad** | Ninguna clave en el código ni en el historial. `.env` y variantes (`.env.local`, etc.) ignorados. | Revisión del repo completo |

## ⚠️ No probado todavía

No tengo acceso a tu servidor, a Coolify ni a tus cuentas. Desde acá tampoco llego a la API de xAI.

- **Conexiones reales:** Telegram, Gemini, Grok, Supabase, Resend, Google Calendar y ntfy.
  → Se prueban con `/diagnostico` (o el workflow 05) una vez desplegado.
- **Modelo de Grok `grok-4.3`:** sale del SDK oficial de xAI, pero no lo pude confirmar contra la API.
  → El diagnóstico te dice si existe y, si no, qué nombre poner en `GROK_MODEL`.
- **El despliegue en Coolify:** las rutas y los nombres de menú pueden variar según tu versión de Coolify.
- **Qué hay corriendo en tu servidor:** no lo pude ver. Revisalo con el Paso 0 de `docs/COOLIFY.md` antes de instalar.

## 📋 Lo que tenés que hacer vos

**Etapa 1 (lo esencial, ~40 min):** seguí [`docs/EMPEZAR.md`](EMPEZAR.md): bot de Telegram, clave de Gemini,
Supabase, n8n en Coolify y probar con un audio. Lo opcional (Grok, email, ntfy, Calendar, app) puede quedar
vacío: el diagnóstico lo muestra como ⏸ pendiente.

**Etapa 2 (completo):**

1. **Revisar el servidor** (Paso 0 de `docs/COOLIFY.md`) y, si querés, pasarme la lista de lo que corre.
2. **Crear el bot** en Telegram con **@BotFather** y anotar tu número de **@userinfobot**.
3. **Sacar las claves:** Gemini (aistudio.google.com), xAI (console.x.ai), Resend, y las de Supabase.
4. **DNS:** `n8n.`, `ntfy.` y `app.` apuntando al servidor.
5. **Supabase:** pegar los 2 archivos SQL, poner tu email, *Site URL* e invitar tu usuario.
6. **Coolify:** crear los 3 recursos (ntfy, n8n, app) y cargar las variables (tabla en `docs/COOLIFY.md`).
7. **En n8n:** crear tu usuario, importar los 5 workflows y activarlos.
8. **Autorizar Google:** credencial de Google Calendar en n8n.
9. **Celular:** instalar la app ("Agregar a pantalla de inicio") y la app ntfy.
10. **Probar:** mandar `/diagnostico` y pasarme el informe si algo sale con ✘.

## 💡 Opcional

- Pasar la rama a `main`.
- Ajustar tono del asistente, hora del briefing o minutos de aviso (hoy 15).
