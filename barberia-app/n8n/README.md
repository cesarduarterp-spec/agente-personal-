# Workflows n8n (pendiente)

Cada 10 minutos, con la `service_role`:
1. `rpc/reclamar_recordatorios` con `{"p_tipo": "24h"}` y luego `{"p_tipo": "2h"}` (devuelve y marca los turnos de forma atómica).
2. Enviar el mail (Resend) a `cliente_email` con botones Reprogramar/Cancelar → `https://tudominio.com/turno/<gestion_token>` y archivo .ics.
3. Si el envío falla: `rpc/liberar_recordatorio` con `{"p_turno": ..., "p_tipo": ...}` para reintentar en la próxima corrida.
