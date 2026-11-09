import type { Tactica } from './schema';

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** ROI = (retornoEsperado - inversionEstimada) / inversionEstimada. Ratio (0.5 = 50 %). */
export function calcROI(retorno: number, inversion: number): number {
  if (!Number.isFinite(retorno) || !Number.isFinite(inversion) || inversion <= 0) return 0;
  return Math.round(((retorno - inversion) / inversion) * 10000) / 10000;
}

export const sumDesglose = (t: Tactica): number =>
  t.pasos[6].desglose.reduce((s, c) => s + (Number.isFinite(c.monto) ? c.monto : 0), 0);

/** Puntaje de riesgo 0-25 (probabilidad × impacto). */
export const riskScore = (t: Tactica): number => (t.pasos[5].probabilidad || 0) * (t.pasos[5].impacto || 0);

export type RiskLevel = 'bajo' | 'medio' | 'alto' | 'sin-dato';
export function riskLevel(t: Tactica): RiskLevel {
  const s = riskScore(t);
  if (s === 0) return 'sin-dato';
  if (s <= 6) return 'bajo';
  if (s <= 14) return 'medio';
  return 'alto';
}

export const costoHerramientasMensual = (t: Tactica): number =>
  t.pasos[4].herramientas.reduce((s, h) => s + (Number.isFinite(h.costoMensual) ? h.costoMensual : 0), 0);

export const costoHerramientasHorizonte = (t: Tactica): number =>
  costoHerramientasMensual(t) * Math.max(1, t.pasos[8].horizonteMeses || 1);

export function ultimaMedicion(t: Tactica) {
  if (t.mediciones.length === 0) return null;
  return [...t.mediciones].sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1) ?? null;
}

/** ROI real con el retorno acumulado de la última medición. */
export function roiReal(t: Tactica): number | null {
  const m = ultimaMedicion(t);
  if (!m) return null;
  return calcROI(m.retornoReal, t.pasos[6].inversionEstimada);
}

export function mesesEntre(desdeISO: string, hasta: Date): number {
  const d = new Date(desdeISO);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, (hasta.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
}

/**
 * Ritmo: % del retorno esperado ya conseguido vs % del horizonte transcurrido.
 * Devuelve null si no hay datos suficientes.
 */
export function ritmo(t: Tactica, hoy = new Date()) {
  const m = ultimaMedicion(t);
  const esperado = t.pasos[8].retornoEsperado;
  const horizonte = t.pasos[8].horizonteMeses;
  if (!m || esperado <= 0 || horizonte <= 0) return null;
  const inicio = t.fechaInicio || t.createdAt;
  const tiempo = Math.min(1, mesesEntre(inicio, new Date(m.fecha) > hoy ? hoy : new Date(m.fecha)) / horizonte);
  const avance = m.retornoReal / esperado;
  return { avance, tiempo };
}

export const fmtMoney = (n: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0,
  );
export const fmtMoneyShort = (n: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(
    Number.isFinite(n) ? n : 0,
  );
export const fmtPct = (r: number): string => `${(r * 100).toFixed(1).replace('.0', '')} %`;

export const todayISO = (d = new Date()): string => {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

export function nuevaTactica(nombre = 'Nueva táctica', now = new Date()): Tactica {
  const iso = now.toISOString();
  return {
    id: uid(),
    nombre,
    canal: '',
    fechaInicio: '',
    createdAt: iso,
    updatedAt: iso,
    estado: 'draft',
    mediciones: [],
    pasos: {
      1: { evidenciaJustifica: '', fuentes: [''] },
      2: { planPasoAPaso: ['', '', ''] },
      3: { responsable: '', equipo: [''] },
      4: { herramientas: [{ nombre: '', costoMensual: 0 }] },
      5: { riesgoPrincipal: '', mitigacion: '', probabilidad: 0, impacto: 0 },
      6: { inversionEstimada: 0, desglose: [{ concepto: '', monto: 0 }] },
      7: { kpiExito: '', formulaMedicion: '', frecuencia: '' },
      8: { retornoEsperado: 0, horizonteMeses: 0, roiProyectado: 0 },
    },
  };
}

/** Recalcula campos derivados (inversión = suma desglose, ROI). Pura. */
export function derive(t: Tactica): Tactica {
  const inversion = Math.round(sumDesglose(t) * 100) / 100;
  const roi = calcROI(t.pasos[8].retornoEsperado, inversion);
  if (inversion === t.pasos[6].inversionEstimada && roi === t.pasos[8].roiProyectado) return t;
  return {
    ...t,
    pasos: {
      ...t.pasos,
      6: { ...t.pasos[6], inversionEstimada: inversion },
      8: { ...t.pasos[8], roiProyectado: roi },
    },
  };
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
