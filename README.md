# Asistente Ejecutivo Personal · Voice-First

Hablale por **Telegram** (audio o texto) → **Gemini 2.5** escucha el audio directamente y decide qué hacer →
**n8n** ejecuta contra **Supabase** → la **PWA** se actualiza en vivo. Además: recordatorios con botones,
push crítico por **ntfy**, briefing matutino por Telegram y email, y sincronización bidireccional con **Google Calendar**.

```
Telegram (voz/texto/botones) ──► n8n ──► Gemini 2.5 (audio nativo + function calling + Google Search)
                                  │
                                  ├──► Supabase (tasks + RPC + Realtime) ◄──► PWA Next.js
                                  ├──► ntfy (push alta prioridad)
                                  ├──► Resend (briefing por email)
                                  └──► Google Calendar (ida y vuelta)
```

## Entregables

| # | Entregable | Dónde |
|---|---|---|
| 1 | Script SQL (tabla `tasks`, triggers, funciones RPC, RLS, Realtime) | [`database/001_init.sql`](database/001_init.sql) |
| 2 | `docker-compose.yml` + Caddy (SSL) + `.env` de ejemplo | [`infra/`](infra/) |
| 3 | Diseño de nodos n8n + JSON de las tools del agente + workflows importables | [`docs/n8n-design.md`](docs/n8n-design.md), [`n8n/tools/gemini-tools.json`](n8n/tools/gemini-tools.json), [`n8n/workflows/`](n8n/workflows/) |
| 4 | PWA Next.js (App Router, Tailwind v4, estilo shadcn/ui, `manifest.json`, service worker) | [`web/`](web/) |

Guía paso a paso de despliegue: **[`docs/SETUP.md`](docs/SETUP.md)**.

## Estructura

```
database/001_init.sql          esquema + lógica de negocio en SQL (idempotente)
infra/                         docker-compose.yml, Caddyfile, .env.example
n8n/
  src/                         código de cada nodo Code (fuente de verdad)
  tools/gemini-tools.json      function declarations de Gemini
  prompts/system-prompt.md     prompt del agente
  workflows/                   JSON importables (generados)
scripts/
  build-n8n.mjs                genera los workflows y valida la sintaxis
  test-n8n-nodes.mjs           prueba los nodos contra Postgres real (Telegram/Gemini simulados)
web/                           PWA Next.js (vistas Hoy / Semana / Mes)
```

## PWA

- **Bottom tab bar** en móvil (Hoy · Semana · Mes) y sidebar en escritorio.
- **Pills de categoría** horizontales (filtro persistido).
- **Checkbox grande** animado; **swipe →** completa, **swipe ←** pasa a mañana; feedback háptico.
- **Realtime**: suscripción a `postgres_changes` de `tasks` + resincronización al volver de segundo plano.
- **Botón de micrófono** que abre el chat del bot para grabar un audio.
- Login por **link mágico** de Supabase; RLS solo permite los emails de `app_users`.

## Categorías

`#Constructora` · `#AgenciaViajes` · `#ConsultoraIA` · `#Estudio` · `#Personal`
