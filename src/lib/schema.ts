import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Modelo de datos                                                     */
/* Base: el brief. Extensiones (documentadas en README):               */
/*  - canal, fechaInicio, createdAt, updatedAt                         */
/*  - paso 5: probabilidad + impacto (1-5) => puntaje de riesgo        */
/*  - mediciones[]: resultados reales para comprobar el ROI            */
/* ------------------------------------------------------------------ */

export const ESTADOS = ['draft', 'aprobada', 'ejecutando', 'medida'] as const;
export type Estado = (typeof ESTADOS)[number];

export const ESTADO_LABEL: Record<Estado, string> = {
  draft: 'Borrador',
  aprobada: 'Aprobada',
  ejecutando: 'Ejecutando',
  medida: 'Medida',
};

export const FRECUENCIAS = ['semanal', 'quincenal', 'mensual', 'trimestral'] as const;

export interface Herramienta {
  nombre: string;
  costoMensual: number;
}
export interface Concepto {
  concepto: string;
  monto: number;
}
export interface Medicion {
  id: string;
  fecha: string; // YYYY-MM-DD
  valorKpi: number;
  retornoReal: number; // retorno acumulado a la fecha
  nota: string;
}

export interface Pasos {
  1: { evidenciaJustifica: string; fuentes: string[] };
  2: { planPasoAPaso: string[] };
  3: { responsable: string; equipo: string[] };
  4: { herramientas: Herramienta[] };
  5: { riesgoPrincipal: string; mitigacion: string; probabilidad: number; impacto: number };
  6: { inversionEstimada: number; desglose: Concepto[] };
  7: { kpiExito: string; formulaMedicion: string; frecuencia: string };
  8: { retornoEsperado: number; horizonteMeses: number; roiProyectado: number };
}

export interface Tactica {
  id: string;
  nombre: string;
  canal: string;
  fechaInicio: string; // YYYY-MM-DD o ''
  createdAt: string;
  updatedAt: string;
  pasos: Pasos;
  estado: Estado;
  mediciones: Medicion[];
}

export interface State {
  tacticas: Tactica[];
}

export type PasoN = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const PASOS: PasoN[] = [1, 2, 3, 4, 5, 6, 7, 8];

export const PASO_META: Record<PasoN, { titulo: string; pregunta: string }> = {
  1: { titulo: 'Evidencia', pregunta: '¿Qué datos justifican esta táctica?' },
  2: { titulo: 'Plan', pregunta: '¿Cuáles son los pasos concretos, en orden?' },
  3: { titulo: 'Responsables', pregunta: '¿Quién la lleva y con qué equipo?' },
  4: { titulo: 'Herramientas', pregunta: '¿Qué herramientas necesitas y cuánto cuestan al mes?' },
  5: { titulo: 'Riesgo', pregunta: '¿Qué puede salir mal y cómo lo mitigas?' },
  6: { titulo: 'Inversión', pregunta: '¿Cuánto cuesta ejecutarla, desglosado?' },
  7: { titulo: 'KPI', pregunta: '¿Cómo sabrás que funcionó?' },
  8: { titulo: 'Retorno', pregunta: '¿Qué retorno esperas y en cuánto tiempo?' },
};

/* -------------------- Validación por paso (wizard) ------------------ */

const txt = (min: number, msg: string) => z.string().trim().min(min, msg);
const money = z.coerce.number({ invalid_type_error: 'Debe ser un número' });

export const pasoSchemas = {
  1: z.object({
    evidenciaJustifica: txt(20, 'Describe la evidencia con al menos 20 caracteres'),
    fuentes: z.array(txt(3, 'Fuente demasiado corta')).min(1, 'Añade al menos una fuente'),
  }),
  2: z.object({
    planPasoAPaso: z.array(txt(3, 'Paso demasiado corto')).min(3, 'Un plan necesita al menos 3 pasos'),
  }),
  3: z.object({
    responsable: txt(2, 'Indica un responsable'),
    equipo: z.array(txt(2, 'Nombre demasiado corto')).min(1, 'Añade al menos una persona al equipo'),
  }),
  4: z.object({
    herramientas: z
      .array(
        z.object({
          nombre: txt(2, 'Nombre requerido'),
          costoMensual: money.min(0, 'No puede ser negativo'),
        }),
      )
      .min(1, 'Añade al menos una herramienta (puede costar 0)'),
  }),
  5: z.object({
    riesgoPrincipal: txt(10, 'Describe el riesgo (mín. 10 caracteres)'),
    mitigacion: txt(10, 'Describe la mitigación (mín. 10 caracteres)'),
    probabilidad: z.coerce.number().int().min(1, 'Elige 1-5').max(5),
    impacto: z.coerce.number().int().min(1, 'Elige 1-5').max(5),
  }),
  6: z
    .object({
      inversionEstimada: money.positive('La inversión debe ser mayor que 0'),
      desglose: z
        .array(
          z.object({
            concepto: txt(2, 'Concepto requerido'),
            monto: money.positive('Monto mayor que 0'),
          }),
        )
        .min(1, 'Desglosa al menos un concepto'),
    })
    .refine((d) => Math.abs(d.desglose.reduce((s, c) => s + c.monto, 0) - d.inversionEstimada) < 0.01, {
      message: 'La inversión debe coincidir con la suma del desglose',
      path: ['inversionEstimada'],
    }),
  7: z.object({
    kpiExito: txt(3, 'Define el KPI'),
    formulaMedicion: txt(5, 'Escribe la fórmula de medición'),
    frecuencia: z.enum(FRECUENCIAS, { errorMap: () => ({ message: 'Elige una frecuencia' }) }),
  }),
  8: z.object({
    retornoEsperado: money.min(0, 'No puede ser negativo'),
    horizonteMeses: z.coerce.number().int('Meses enteros').min(1, 'Mínimo 1 mes').max(60, 'Máximo 60 meses'),
    roiProyectado: z.number(),
  }),
} satisfies Record<PasoN, z.ZodTypeAny>;

export function pasoValido(t: Tactica, n: PasoN): boolean {
  return pasoSchemas[n].safeParse(t.pasos[n]).success;
}
export function pasosValidos(t: Tactica): PasoN[] {
  return PASOS.filter((n) => pasoValido(t, n));
}
export function tacticaCompleta(t: Tactica): boolean {
  return pasosValidos(t).length === 8 && t.nombre.trim().length >= 3;
}

/* ------------- Esquema de almacenamiento (import / share) ----------- */
/* Tipos estrictos pero sin mínimos de negocio: un borrador es válido.  */

const strArr = z.array(z.string());
export const tacticaStoredSchema: z.ZodType<Tactica> = z.object({
  id: z.string().min(1),
  nombre: z.string(),
  canal: z.string().default(''),
  fechaInicio: z.string().default(''),
  createdAt: z.string(),
  updatedAt: z.string(),
  estado: z.enum(ESTADOS),
  mediciones: z
    .array(
      z.object({
        id: z.string(),
        fecha: z.string(),
        valorKpi: z.number(),
        retornoReal: z.number(),
        nota: z.string().default(''),
      }),
    )
    .default([]),
  pasos: z.object({
    1: z.object({ evidenciaJustifica: z.string(), fuentes: strArr }),
    2: z.object({ planPasoAPaso: strArr }),
    3: z.object({ responsable: z.string(), equipo: strArr }),
    4: z.object({ herramientas: z.array(z.object({ nombre: z.string(), costoMensual: z.number() })) }),
    5: z.object({
      riesgoPrincipal: z.string(),
      mitigacion: z.string(),
      probabilidad: z.number().min(0).max(5).default(0),
      impacto: z.number().min(0).max(5).default(0),
    }),
    6: z.object({
      inversionEstimada: z.number(),
      desglose: z.array(z.object({ concepto: z.string(), monto: z.number() })),
    }),
    7: z.object({ kpiExito: z.string(), formulaMedicion: z.string(), frecuencia: z.string() }),
    8: z.object({ retornoEsperado: z.number(), horizonteMeses: z.number(), roiProyectado: z.number() }),
  }),
}) as unknown as z.ZodType<Tactica>;

export const stateSchema = z.object({ tacticas: z.array(tacticaStoredSchema) });

export const STORAGE_VERSION = 1 as const;
export const envelopeSchema = z.object({
  v: z.literal(STORAGE_VERSION),
  updatedAt: z.string(),
  data: stateSchema,
});
export type Envelope = z.infer<typeof envelopeSchema>;
