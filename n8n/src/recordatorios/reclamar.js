//@include _lib
// Toma (y marca reminder_sent=true de forma atómica) los recordatorios vencidos.
// Consulta equivalente: status='pendiente' AND reminder_sent=false AND reminder_at <= NOW()
const tasks = await rpc('fn_claim_due_reminders', { p_limit: 50 });
return (tasks || []).map((t) => ({ json: t }));
