import { z } from 'zod';
import type { Envelope, State } from '../types';

const nombre = z.string().trim().min(1, 'El nombre es obligatorio').max(80, 'Máximo 80 caracteres');

export const avatarSchema = z.object({
  id: z.string().min(1),
  nombre,
  tamañoSegmento: z
    .number({ invalid_type_error: 'Introduce un número' })
    .int('Debe ser un número entero')
    .min(0, 'No puede ser negativo')
    .max(1_000_000_000, 'Valor demasiado alto'),
});

export const productoSchema = z.object({
  id: z.string().min(1),
  nombre,
  precio: z
    .number({ invalid_type_error: 'Introduce un número' })
    .min(0, 'No puede ser negativo')
    .max(100_000_000, 'Valor demasiado alto'),
});

export const celdaSchema = z.object({
  avatarId: z.string().min(1),
  productoId: z.string().min(1),
  compra: z.boolean(),
  unidades: z
    .number({ invalid_type_error: 'Introduce un número' })
    .int('Debe ser un número entero')
    .min(0, 'No puede ser negativo')
    .max(100_000_000, 'Valor demasiado alto'),
  npsDelMatch: z
    .number({ invalid_type_error: 'Introduce un número' })
    .int('Debe ser un entero')
    .min(0, 'Mínimo 0')
    .max(10, 'Máximo 10')
    .optional(),
  notas: z.string().max(500, 'Máximo 500 caracteres').optional(),
});

export const stateSchema = z
  .object({
    avatares: z.array(avatarSchema).max(200),
    productos: z.array(productoSchema).max(200),
    celdas: z.array(celdaSchema).max(40_000),
  })
  .superRefine((s, ctx) => {
    const aIds = new Set<string>();
    s.avatares.forEach((a, i) => {
      if (aIds.has(a.id)) ctx.addIssue({ code: 'custom', message: `Avatar duplicado: ${a.id}`, path: ['avatares', i, 'id'] });
      aIds.add(a.id);
    });
    const pIds = new Set<string>();
    s.productos.forEach((p, i) => {
      if (pIds.has(p.id)) ctx.addIssue({ code: 'custom', message: `Producto duplicado: ${p.id}`, path: ['productos', i, 'id'] });
      pIds.add(p.id);
    });
    const keys = new Set<string>();
    s.celdas.forEach((c, i) => {
      if (!aIds.has(c.avatarId) || !pIds.has(c.productoId)) {
        ctx.addIssue({ code: 'custom', message: 'Celda con referencia a un avatar o producto inexistente', path: ['celdas', i] });
      }
      const k = `${c.avatarId}::${c.productoId}`;
      if (keys.has(k)) ctx.addIssue({ code: 'custom', message: 'Celda duplicada', path: ['celdas', i] });
      keys.add(k);
    });
  });

export const envelopeSchema = z.object({
  v: z.literal(1),
  updatedAt: z.string(),
  data: stateSchema,
});

export type ParseResult = { ok: true; data: State } | { ok: false; error: string };

/** Acepta un envoltorio versionado { v, updatedAt, data } o un State desnudo. */
export function parseState(input: unknown): ParseResult {
  const candidate =
    input && typeof input === 'object' && 'v' in (input as Record<string, unknown>) ? envelopeSchema.safeParse(input) : null;
  if (candidate) {
    if (candidate.success) return { ok: true, data: candidate.data.data as State };
    return { ok: false, error: formatZodError(candidate.error) };
  }
  const raw = stateSchema.safeParse(input);
  if (raw.success) return { ok: true, data: raw.data as State };
  return { ok: false, error: formatZodError(raw.error) };
}

function formatZodError(err: z.ZodError): string {
  const first = err.issues[0];
  if (!first) return 'Formato no válido';
  const path = first.path.length ? ` (${first.path.join('.')})` : '';
  return `${first.message}${path}`;
}

export function makeEnvelope(data: State): Envelope {
  return { v: 1, updatedAt: new Date().toISOString(), data };
}

// Esquemas de formularios (sin id)
export const avatarFormSchema = avatarSchema.omit({ id: true });
export const productoFormSchema = productoSchema.omit({ id: true });
export const celdaFormSchema = z.object({
  compra: z.boolean(),
  unidades: celdaSchema.shape.unidades,
  npsDelMatch: z.number().int('Debe ser un entero').min(0, 'Mínimo 0').max(10, 'Máximo 10').nullable(),
  notas: z.string().max(500, 'Máximo 500 caracteres'),
});
export type AvatarForm = z.infer<typeof avatarFormSchema>;
export type ProductoForm = z.infer<typeof productoFormSchema>;
export type CeldaForm = z.infer<typeof celdaFormSchema>;
