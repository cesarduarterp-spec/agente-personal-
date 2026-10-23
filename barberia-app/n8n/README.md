# Recordatorios por mail con n8n

n8n solo **dispara** el envío cada 10 minutos. La lógica vive en la app (`web/app/api/recordatorios/route.ts`),
así las plantillas de mail están en un solo lugar y n8n no necesita acceso a la base.

Cómo funciona cada corrida:
1. La app llama a `reclamar_recordatorios('24h')` y `('2h')`. La base devuelve y marca los turnos de forma
   **atómica**: dos corridas superpuestas nunca mandan el mismo aviso dos veces.
2. Envía el mail (Resend) a cada cliente.
3. Si un envío falla, llama a `liberar_recordatorio` y se reintenta en la próxima corrida.

Reglas: el aviso de 24 h sale entre 24 h y 3 h antes del turno; el de 2 h, entre 2 h y 0 h antes.
No se manda un aviso si el turno se reservó con menos tiempo que el del aviso (ya recibió la confirmación).

## Puesta en marcha
1. **n8n en el VPS** (Coolify → *New Resource* → n8n). Si sigue en tu PC, los recordatorios no salen cuando se apaga.
2. En la app (Coolify) definir `CRON_SECRET` con un valor largo y aleatorio (`openssl rand -hex 32`).
   Sin esa variable el endpoint responde 503 (deshabilitado).
3. En n8n → *Credentials* → **Header Auth**: nombre `Authorization`, valor `Bearer <tu CRON_SECRET>`.
4. Importar `recordatorios.json` (*Workflows → Import from file*), cambiar la URL por la de tu dominio,
   asignar la credencial en el nodo *Enviar recordatorios* y **activar** el workflow.
5. Probarlo: botón *Execute workflow*. La respuesta es `{"ok":true,"resumen":{"24h":{...},"2h":{...}}}`.

> El JSON está escrito a mano según el formato de n8n y no pudo importarse en esta sesión: si n8n objeta algo al
> importar, alcanza con crear a mano dos nodos (*Schedule Trigger* cada 10 min → *HTTP Request* POST con Header Auth).

Alternativa sin n8n: cualquier cron que ejecute
`curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO/api/recordatorios` cada 10 minutos
(por ejemplo, una *Scheduled Task* de Coolify).
