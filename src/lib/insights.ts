import type { Tactica } from './schema';
import { tacticaCompleta, pasosValidos } from './schema';
import {
  costoHerramientasHorizonte,
  fmtMoney,
  fmtPct,
  ritmo,
  riskScore,
  roiReal,
  todayISO,
} from './calc';

export interface Insight {
  id: string;
  titulo: string;
  evidencia: string;
  accion: string;
  impacto: number; // 0-100, mayor = más urgente
  tipo: 'alerta' | 'oportunidad' | 'salud';
  tacticaIds: string[];
}

const STOP = new Set(
  'para porque sobre entre desde hasta cuando donde quien cual cuales tiene tienen puede pueden podria seria estar estos estas esto esta este como mucho poco menos mayor menor muy algo nada todo todos todas otra otro otros otras nuestro nuestra clientes cliente'.split(
    ' ',
  ),
);

export function tokensRiesgo(texto: string): string[] {
  return Array.from(
    new Set(
      texto
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .split(/[^a-zñ0-9]+/)
        .filter((w) => w.length >= 5 && !STOP.has(w))
        // stemming mínimo: plural -> singular
        .map((w) => (w.endsWith('es') && w.length > 6 ? w.slice(0, -2) : w.endsWith('s') ? w.slice(0, -1) : w)),
    ),
  );
}

const nombres = (ts: Tactica[], max = 3) =>
  ts
    .slice(0, max)
    .map((t) => `«${t.nombre}»`)
    .join(', ') + (ts.length > max ? ` y ${ts.length - max} más` : '');

/** Motor de reglas determinista. Devuelve 3-6 hallazgos ordenados por impacto (o [] si no hay tácticas). */
export function computeInsights(tacticas: Tactica[], hoy = new Date()): Insight[] {
  if (tacticas.length === 0) return [];
  const out: Insight[] = [];
  const conInversion = tacticas.filter((t) => t.pasos[6].inversionEstimada > 0);

  // 1. ROI negativo proyectado
  const negativas = conInversion.filter((t) => t.pasos[8].horizonteMeses > 0 && t.pasos[8].roiProyectado < 0);
  if (negativas.length) {
    const perdida = negativas.reduce((s, t) => s + (t.pasos[6].inversionEstimada - t.pasos[8].retornoEsperado), 0);
    out.push({
      id: 'roi-negativo',
      tipo: 'alerta',
      impacto: 95,
      titulo: `${negativas.length} táctica${negativas.length > 1 ? 's' : ''} con ROI negativo proyectado`,
      evidencia: `${nombres(negativas)} proyecta${negativas.length > 1 ? 'n' : ''} perder ${fmtMoney(perdida)} en total.`,
      accion: 'Recorta la inversión, sube el retorno esperado con evidencia o descarta la táctica antes de aprobarla.',
      tacticaIds: negativas.map((t) => t.id),
    });
  }

  // 2. Resultados reales por debajo del ritmo (comprobación)
  const lentas = tacticas.filter((t) => {
    if (t.estado !== 'ejecutando' && t.estado !== 'medida') return false;
    const r = ritmo(t, hoy);
    return r !== null && r.tiempo > 0.1 && r.avance < r.tiempo * 0.7;
  });
  if (lentas.length) {
    const ej = lentas[0]!;
    const r = ritmo(ej, hoy)!;
    out.push({
      id: 'ritmo-bajo',
      tipo: 'alerta',
      impacto: 90,
      titulo: 'Resultados reales por debajo del plan',
      evidencia: `${nombres(lentas)}: ${ej.nombre} lleva ${fmtPct(r.avance)} del retorno con ${fmtPct(r.tiempo)} del horizonte consumido.`,
      accion: 'Revisa el KPI con el responsable esta semana y decide: corregir, pausar o reasignar presupuesto.',
      tacticaIds: lentas.map((t) => t.id),
    });
  }

  // 3. Concentración de inversión por canal
  const porCanal = new Map<string, number>();
  for (const t of conInversion) {
    const c = t.canal.trim() || 'Sin canal';
    porCanal.set(c, (porCanal.get(c) ?? 0) + t.pasos[6].inversionEstimada);
  }
  const total = [...porCanal.values()].reduce((a, b) => a + b, 0);
  if (conInversion.length >= 2 && total > 0) {
    const [topCanal, topMonto] = [...porCanal.entries()].sort((a, b) => b[1] - a[1])[0]!;
    const share = topMonto / total;
    if (share >= 0.5) {
      out.push({
        id: 'concentracion',
        tipo: 'alerta',
        impacto: share >= 0.75 ? 85 : 70,
        titulo: `${fmtPct(share)} de la inversión en un solo canal`,
        evidencia: `«${topCanal}» concentra ${fmtMoney(topMonto)} de ${fmtMoney(total)} (${porCanal.size} canal${porCanal.size > 1 ? 'es' : ''} en total).`,
        accion: 'Diversifica: mueve al menos un 20 % del presupuesto a una táctica en otro canal con ROI positivo.',
        tacticaIds: conInversion.filter((t) => (t.canal.trim() || 'Sin canal') === topCanal).map((t) => t.id),
      });
    }
  }

  // 4. Riesgos recurrentes
  const freq = new Map<string, Set<string>>();
  for (const t of tacticas) {
    for (const w of tokensRiesgo(t.pasos[5].riesgoPrincipal)) {
      if (!freq.has(w)) freq.set(w, new Set());
      freq.get(w)!.add(t.id);
    }
  }
  const recurrentes = [...freq.entries()].filter(([, s]) => s.size >= 2).sort((a, b) => b[1].size - a[1].size);
  if (recurrentes.length) {
    const top = recurrentes.slice(0, 3);
    const ids = Array.from(new Set(top.flatMap(([, s]) => [...s])));
    out.push({
      id: 'riesgo-recurrente',
      tipo: 'alerta',
      impacto: 60 + Math.min(20, ids.length * 5),
      titulo: 'Riesgo recurrente entre tácticas',
      evidencia: `Términos repetidos en riesgos: ${top.map(([w, s]) => `“${w}” (${s.size})`).join(', ')}.`,
      accion: 'Crea una mitigación compartida (un responsable, un presupuesto) en vez de mitigarlo táctica por táctica.',
      tacticaIds: ids,
    });
  }

  // 5. Costo de herramientas no presupuestado
  const ocultas = conInversion.filter((t) => {
    const herr = costoHerramientasHorizonte(t);
    const nombresH = t.pasos[4].herramientas.map((h) => h.nombre.toLowerCase().trim()).filter(Boolean);
    const incluidas = t.pasos[6].desglose.some((d) => {
      const c = d.concepto.toLowerCase();
      return c.includes('herramient') || c.includes('software') || nombresH.some((n) => n && c.includes(n));
    });
    return herr > 0 && !incluidas && herr / t.pasos[6].inversionEstimada >= 0.1;
  });
  if (ocultas.length) {
    const extra = ocultas.reduce((s, t) => s + costoHerramientasHorizonte(t), 0);
    out.push({
      id: 'costo-oculto',
      tipo: 'alerta',
      impacto: 65,
      titulo: 'Costo de herramientas fuera del presupuesto',
      evidencia: `${nombres(ocultas)} suman ${fmtMoney(extra)} en herramientas durante el horizonte, sin línea en el desglose.`,
      accion: 'Añade una línea “Herramientas” al desglose de inversión para que el ROI sea honesto.',
      tacticaIds: ocultas.map((t) => t.id),
    });
  }

  // 6. Listas para ejecutar esta semana
  const hoyISO = todayISO(hoy);
  const en7 = todayISO(new Date(hoy.getTime() + 7 * 86400000));
  const listas = tacticas.filter(
    (t) =>
      t.estado === 'aprobada' &&
      tacticaCompleta(t) &&
      t.pasos[8].roiProyectado >= 0 &&
      (!t.fechaInicio || t.fechaInicio <= en7),
  );
  if (listas.length) {
    const atrasadas = listas.filter((t) => t.fechaInicio && t.fechaInicio < hoyISO).length;
    out.push({
      id: 'listas-semana',
      tipo: 'oportunidad',
      impacto: 75,
      titulo: `${listas.length} táctica${listas.length > 1 ? 's' : ''} lista${listas.length > 1 ? 's' : ''} para ejecutar esta semana`,
      evidencia: `${nombres(listas)}: 8/8 pasos validados, aprobadas y con ROI ≥ 0${atrasadas ? ` (${atrasadas} con fecha de inicio vencida)` : ''}.`,
      accion: 'Muévelas a “Ejecutando” y agenda el kickoff con cada responsable hoy.',
      tacticaIds: listas.map((t) => t.id),
    });
  }

  // 7. Ejecutando sin mediciones
  const sinMedir = tacticas.filter(
    (t) => t.estado === 'ejecutando' && t.mediciones.length === 0 && t.fechaInicio && t.fechaInicio < hoyISO,
  );
  if (sinMedir.length) {
    out.push({
      id: 'sin-medicion',
      tipo: 'alerta',
      impacto: 55,
      titulo: 'Tácticas en ejecución sin datos reales',
      evidencia: `${nombres(sinMedir)} ya iniciaron y no tienen ninguna medición registrada.`,
      accion: 'Registra la primera medición del KPI; sin dato real el ROI es solo una promesa.',
      tacticaIds: sinMedir.map((t) => t.id),
    });
  }

  // 8. ROI real vs proyectado (medidas)
  const desviadas = tacticas.filter((t) => {
    if (t.estado !== 'medida') return false;
    const real = roiReal(t);
    return real !== null && Math.abs(real - t.pasos[8].roiProyectado) > 0.3;
  });
  if (desviadas.length) {
    out.push({
      id: 'desviacion',
      tipo: 'salud',
      impacto: 50,
      titulo: 'Proyecciones desviadas más de 30 puntos',
      evidencia: desviadas
        .slice(0, 3)
        .map((t) => `«${t.nombre}»: proyectado ${fmtPct(t.pasos[8].roiProyectado)} vs real ${fmtPct(roiReal(t)!)}`)
        .join('; '),
      accion: 'Ajusta tus supuestos de retorno en las próximas tácticas con este dato real.',
      tacticaIds: desviadas.map((t) => t.id),
    });
  }

  // 9. Borradores incompletos
  const incompletas = tacticas.filter((t) => t.estado === 'draft' && pasosValidos(t).length < 8);
  if (incompletas.length) {
    const faltan = incompletas.reduce((s, t) => s + (8 - pasosValidos(t).length), 0);
    out.push({
      id: 'borradores',
      tipo: 'salud',
      impacto: 35,
      titulo: `${incompletas.length} borrador${incompletas.length > 1 ? 'es' : ''} sin aterrizar`,
      evidencia: `Faltan ${faltan} pasos por validar en ${nombres(incompletas)}.`,
      accion: 'Completa primero el borrador con mayor inversión: es el que más decisión bloquea.',
      tacticaIds: incompletas.map((t) => t.id),
    });
  }

  // Relleno de salud para garantizar mínimo 3 hallazgos
  const fillers: Insight[] = [];
  if (!out.some((i) => i.id === 'roi-negativo') && conInversion.length) {
    const mejor = [...conInversion].sort((a, b) => b.pasos[8].roiProyectado - a.pasos[8].roiProyectado)[0]!;
    fillers.push({
      id: 'mejor-roi',
      tipo: 'oportunidad',
      impacto: 30,
      titulo: 'Ninguna táctica proyecta pérdidas',
      evidencia: `Mejor ROI proyectado: «${mejor.nombre}» con ${fmtPct(mejor.pasos[8].roiProyectado)}.`,
      accion: 'Prioriza la de mayor ROI con menor riesgo para la próxima ventana de ejecución.',
      tacticaIds: [mejor.id],
    });
  }
  const masRiesgo = [...tacticas].sort((a, b) => riskScore(b) - riskScore(a))[0]!;
  if (riskScore(masRiesgo) > 0) {
    fillers.push({
      id: 'mayor-riesgo',
      tipo: 'salud',
      impacto: 25,
      titulo: 'Táctica con mayor exposición al riesgo',
      evidencia: `«${masRiesgo.nombre}» tiene puntaje ${riskScore(masRiesgo)}/25: ${masRiesgo.pasos[5].riesgoPrincipal.slice(0, 80)}`,
      accion: 'Asigna fecha y dueño concretos a la mitigación antes de invertir.',
      tacticaIds: [masRiesgo.id],
    });
  }
  const totalInv = conInversion.reduce((s, t) => s + t.pasos[6].inversionEstimada, 0);
  const totalRet = conInversion.reduce((s, t) => s + t.pasos[8].retornoEsperado, 0);
  fillers.push({
    id: 'resumen',
    tipo: 'salud',
    impacto: 20,
    titulo: 'Resumen del portafolio',
    evidencia: `${tacticas.length} tácticas · inversión ${fmtMoney(totalInv)} · retorno esperado ${fmtMoney(totalRet)}.`,
    accion:
      totalInv > 0
        ? 'Registra mediciones reales cada ciclo para convertir proyecciones en evidencia.'
        : 'Completa el paso 6 (inversión) de tus tácticas para activar el análisis de ROI.',
    tacticaIds: [],
  });

  const sorted = out.sort((a, b) => b.impacto - a.impacto).slice(0, 6);
  for (const f of fillers) {
    if (sorted.length >= 3) break;
    sorted.push(f);
  }
  return sorted;
}
