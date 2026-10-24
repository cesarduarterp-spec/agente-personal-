// Dispara el envío de recordatorios. Corre DENTRO del contenedor de la app (Tarea programada de Coolify):
//   node scripts/recordatorios.mjs
// Usa CRON_SECRET y PORT del propio contenedor; sale con código 1 si falla, así Coolify la marca como fallida.
const puerto = process.env.PORT || 3000;
try {
  const r = await fetch(`http://127.0.0.1:${puerto}/api/recordatorios`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  console.log(r.status, await r.text());
  process.exit(r.ok ? 0 : 1);
} catch (e) {
  console.error("ERROR", e.message);
  process.exit(1);
}
