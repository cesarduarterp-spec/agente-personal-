import { createClient } from "@supabase/supabase-js";

// Cliente anónimo sin cookies: solo puede llamar a las funciones públicas de la base.
export function createPublicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const ERRORES: Record<string, string> = {
  horario_no_disponible: "Ese horario se acaba de ocupar. Elegí otro.",
  fuera_de_zona: "Tu dirección está fuera de la zona de cobertura del barbero.",
  direccion_requerida: "Elegí tu dirección de la lista para que el barbero sepa dónde ir.",
  falta_consentimiento: "Tenés que aceptar el uso de tus datos para reservar.",
  datos_invalidos: "Revisá tu nombre, teléfono y mail.",
  modalidad_no_disponible: "Esa modalidad no está disponible en esta barbería.",
  fuera_de_plazo: "Ya pasó el plazo para modificar este turno. Contactá al barbero.",
  turno_no_modificable: "Este turno ya no se puede modificar.",
  turno_no_existe: "No encontramos este turno.",
  barberia_no_existe: "No encontramos esta barbería.",
  barberia_inactiva: "Esta barbería no está recibiendo reservas por el momento.",
};

export function mensajeError(message: string | undefined) {
  const clave = Object.keys(ERRORES).find((k) => message?.includes(k));
  return clave ? ERRORES[clave] : "Ocurrió un error. Probá de nuevo.";
}

export function fmtFechaHora(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short", timeZone }).format(new Date(iso));
}

// Próximos días en la zona horaria de la barbería (se calcula en el servidor).
export function diasProximos(timeZone: string, n = 14) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const corto = new Intl.DateTimeFormat("es-AR", { timeZone, weekday: "short", day: "numeric" });
  const ahora = Date.now();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(ahora + i * 864e5);
    return { fecha: f.format(d), etiqueta: corto.format(d) };
  });
}
export type Dia = ReturnType<typeof diasProximos>[number];
