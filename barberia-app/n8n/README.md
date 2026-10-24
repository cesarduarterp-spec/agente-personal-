# Recordatorios por mail

La lógica vive en la app (`web/app/api/recordatorios/route.ts`): cada vez que algo la llama, reclama de forma
**atómica** los turnos que necesitan aviso (24 h y 2 h antes), manda el mail por Resend y, si un envío falla,
lo libera para reintentar. Dos ejecuciones a la vez nunca mandan el mismo aviso dos veces.

Reglas: el aviso de 24 h sale entre 24 h y 3 h antes del turno; el de 2 h, entre 2 h y 0 h antes. No se manda un
aviso si el turno se reservó con menos tiempo que ese aviso (ya recibió la confirmación). El cliente puede
responder el mail: la respuesta le llega al barbero (*Reply-To*).

## Opción A (recomendada): tarea programada de Coolify
No necesita n8n ni `curl`. Corre **dentro del contenedor de la app**, así el secreto nunca queda escrito en la tarea.

Coolify → tu aplicación → **Scheduled Tasks** → **Add**:
- **Name:** `recordatorios`
- **Command:** `node scripts/recordatorios.mjs`
- **Frequency:** `*/10 * * * *` (cada 10 minutos)
- **Container:** el de la app (si te pide elegir, dejá el único que aparece)

Requisito: la variable `CRON_SECRET` cargada en la app (la misma que ya tenés). Probado: con el secreto correcto
responde `200 {"ok":true,"resumen":...}`; con uno incorrecto responde `401` y sale con error.

Para probarlo a mano: en la tarea, botón **Execute now** y mirá la ejecución en el historial.

## Opción B: n8n
Importá `recordatorios.json` (Workflows → Import from file): *Schedule Trigger* cada 10 minutos → *HTTP Request* POST a
`https://agenda.wameta.app/api/recordatorios` con una credencial **Header Auth** (`Authorization: Bearer <CRON_SECRET>`).
El n8n tiene que correr en el VPS (si corre en tu PC y se apaga, no salen los avisos).
> El JSON está escrito a mano y no se pudo importar en una instalación real: si n8n objeta algo, armá los dos nodos a mano.
