import { toPng } from 'html-to-image';
import type { Tactica } from './schema';
import { ESTADO_LABEL, PASO_META, PASOS, pasosValidos } from './schema';
import { computeInsights } from './insights';
import {
  costoHerramientasMensual,
  fmtMoney,
  fmtPct,
  riskLevel,
  riskScore,
  roiReal,
  slugify,
  todayISO,
} from './calc';

export const EXPORT_NODE_ID = 'export-canvas';
const COPYRIGHT = '© Vilma Núñez, PhD — Todos los derechos reservados';

function download(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const stamp = () => todayISO();

/* ------------------------------- PNG -------------------------------- */

export async function canvasToPng(pixelRatio = 2): Promise<string> {
  const node = document.getElementById(EXPORT_NODE_ID);
  if (!node) throw new Error('No se encontró el canvas para exportar');
  if (document.fonts?.ready) await document.fonts.ready;
  return toPng(node, { pixelRatio, backgroundColor: '#FFFFFF', cacheBust: true });
}

export async function exportPNG() {
  const url = await canvasToPng(2);
  const blob = await (await fetch(url)).blob();
  download(blob, `tactica-aterrizada-portafolio-${stamp()}.png`);
}

/* ------------------------------- CSV -------------------------------- */

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(tacticas: Tactica[]): string {
  const head = [
    'id', 'nombre', 'estado', 'canal', 'fecha_inicio', 'pasos_validos',
    'evidencia', 'fuentes', 'plan', 'responsable', 'equipo', 'herramientas', 'costo_herramientas_mes',
    'riesgo', 'mitigacion', 'probabilidad', 'impacto', 'riesgo_puntaje',
    'inversion', 'desglose', 'kpi', 'formula', 'frecuencia',
    'retorno_esperado', 'horizonte_meses', 'roi_proyectado', 'roi_real', 'mediciones',
  ];
  const rows = tacticas.map((t) => {
    const p = t.pasos;
    const real = roiReal(t);
    return [
      t.id, t.nombre, t.estado, t.canal, t.fechaInicio, pasosValidos(t).length,
      p[1].evidenciaJustifica, p[1].fuentes.filter(Boolean).join(' | '),
      p[2].planPasoAPaso.filter(Boolean).join(' | '), p[3].responsable, p[3].equipo.filter(Boolean).join(' | '),
      p[4].herramientas.map((h) => `${h.nombre}:${h.costoMensual}`).join(' | '), costoHerramientasMensual(t),
      p[5].riesgoPrincipal, p[5].mitigacion, p[5].probabilidad, p[5].impacto, riskScore(t),
      p[6].inversionEstimada, p[6].desglose.map((d) => `${d.concepto}:${d.monto}`).join(' | '),
      p[7].kpiExito, p[7].formulaMedicion, p[7].frecuencia,
      p[8].retornoEsperado, p[8].horizonteMeses, p[8].roiProyectado, real ?? '',
      t.mediciones.map((m) => `${m.fecha}:${m.valorKpi}:${m.retornoReal}`).join(' | '),
    ].map(csvCell).join(',');
  });
  return [head.join(','), ...rows].join('\n');
}

export function exportCSV(tacticas: Tactica[]) {
  download(new Blob(['﻿' + toCSV(tacticas)], { type: 'text/csv;charset=utf-8' }), `tactica-aterrizada-${stamp()}.csv`);
}

/* ------------------------------- JSON ------------------------------- */

export function exportJSONFile(json: string) {
  download(new Blob([json], { type: 'application/json' }), `tactica-aterrizada-${stamp()}.json`);
}

/* ------------------------------- PDF -------------------------------- */

type JsPDF = import('jspdf').jsPDF;

async function loadPdf() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return { jsPDF, autoTable };
}

function footer(doc: JsPDF) {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(0);
    doc.setLineWidth(0.6);
    doc.line(15, h - 14, w - 15, h - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text(COPYRIGHT, 15, h - 8);
    doc.text(`${i} / ${pages}`, w - 15, h - 8, { align: 'right' });
  }
}

function cover(doc: JsPDF, titulo: string, subtitulo: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(255, 230, 0);
  doc.rect(0, 0, w, 120, 'F');
  doc.setDrawColor(0);
  doc.setLineWidth(1.2);
  doc.line(0, 120, w, 120);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TÁCTICA ATERRIZADA', 15, 25);
  doc.setFontSize(30);
  doc.text(doc.splitTextToSize(titulo, w - 30), 15, 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(subtitulo, 15, 108);
  doc.setFontSize(11);
  doc.text(
    `Fecha: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    15,
    140,
  );
  doc.setFont('helvetica', 'bold');
  doc.text('vilmanunez.com', 15, 150);
}

function h2(doc: JsPDF, text: string, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(text, 15, y);
  doc.setLineWidth(1);
  doc.line(15, y + 2, 60, y + 2);
}

function insightsSection(doc: JsPDF, tacticas: Tactica[], startY: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  let y = startY;
  h2(doc, 'Insights automáticos', y);
  y += 12;
  computeInsights(tacticas).forEach((ins, i) => {
    const ev = doc.splitTextToSize(`Evidencia: ${ins.evidencia}`, w - 40) as string[];
    const ac = doc.splitTextToSize(`Acción: ${ins.accion}`, w - 40) as string[];
    const blockH = 8 + (ev.length + ac.length) * 5 + 6;
    if (y + blockH > h - 20) {
      doc.addPage();
      y = 20;
    }
    doc.setFillColor(255, 230, 0);
    doc.rect(15, y - 5, 8, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(String(i + 1), 19, y + 0.5, { align: 'center' });
    doc.setFontSize(11);
    doc.text(doc.splitTextToSize(ins.titulo, w - 40), 27, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(ev, 27, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.text(ac, 27, y + 7 + ev.length * 5);
    y += blockH;
  });
}

export async function exportPDF(tacticas: Tactica[]) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();

  const inv = tacticas.reduce((s, t) => s + t.pasos[6].inversionEstimada, 0);
  const ret = tacticas.reduce((s, t) => s + t.pasos[8].retornoEsperado, 0);
  cover(doc, 'Portafolio de tácticas', `${tacticas.length} tácticas · Inversión ${fmtMoney(inv)} · Retorno ${fmtMoney(ret)}`);

  // Canvas
  doc.addPage();
  h2(doc, 'Matriz ROI × Riesgo', 20);
  try {
    const img = await canvasToPng(2);
    const props = doc.getImageProperties(img);
    const iw = w - 30;
    doc.addImage(img, 'PNG', 15, 28, iw, (props.height * iw) / props.width);
  } catch {
    doc.setFontSize(10);
    doc.text('No se pudo capturar el canvas.', 15, 35);
  }

  // Tabla
  doc.addPage();
  h2(doc, 'Datos del portafolio', 20);
  autoTable(doc, {
    startY: 28,
    head: [['Táctica', 'Estado', 'Canal', 'Inversión', 'Retorno', 'ROI proy.', 'ROI real', 'Riesgo', 'Pasos']],
    body: [...tacticas]
      .sort((a, b) => b.pasos[8].roiProyectado - a.pasos[8].roiProyectado)
      .map((t) => {
        const r = roiReal(t);
        return [
          t.nombre,
          ESTADO_LABEL[t.estado],
          t.canal || '—',
          fmtMoney(t.pasos[6].inversionEstimada),
          fmtMoney(t.pasos[8].retornoEsperado),
          fmtPct(t.pasos[8].roiProyectado),
          r === null ? '—' : fmtPct(r),
          `${riskScore(t)}/25 ${riskLevel(t) === 'sin-dato' ? '' : riskLevel(t)}`,
          `${pasosValidos(t).length}/8`,
        ];
      }),
    styles: { font: 'helvetica', fontSize: 8, textColor: 0, lineColor: 0, lineWidth: 0.3 },
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    margin: { left: 15, right: 15, bottom: 20 },
    columnStyles: { 0: { cellWidth: 45 } },
  });

  doc.addPage();
  insightsSection(doc, tacticas, 20);
  footer(doc);
  doc.save(`tactica-aterrizada-ejecutivo-${stamp()}.pdf`);
}

/** Brief de ejecución de una sola táctica (resultado final del wizard). */
export async function exportBriefPDF(t: Tactica) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const p = t.pasos;
  cover(doc, t.nombre, `Brief de ejecución · ${ESTADO_LABEL[t.estado]} · ${t.canal || 'sin canal'}`);
  doc.addPage();
  h2(doc, 'Resumen ejecutivo', 20);
  autoTable(doc, {
    startY: 28,
    theme: 'grid',
    body: [
      ['Inversión', fmtMoney(p[6].inversionEstimada)],
      ['Retorno esperado', fmtMoney(p[8].retornoEsperado)],
      ['ROI proyectado', fmtPct(p[8].roiProyectado)],
      ['Horizonte', `${p[8].horizonteMeses} meses`],
      ['Inicio', t.fechaInicio || 'Por definir'],
      ['Responsable', p[3].responsable],
      ['KPI de éxito', `${p[7].kpiExito} (${p[7].frecuencia})`],
      ['Riesgo', `${riskScore(t)}/25 — ${p[5].riesgoPrincipal}`],
    ],
    styles: { fontSize: 9, textColor: 0, lineColor: 0, lineWidth: 0.3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
    margin: { left: 15, right: 15, bottom: 20 },
  });
  const sections: [string, string[]][] = PASOS.map((n) => {
    let lines: string[] = [];
    switch (n) {
      case 1: lines = [p[1].evidenciaJustifica, ...p[1].fuentes.filter(Boolean).map((f) => `Fuente: ${f}`)]; break;
      case 2: lines = p[2].planPasoAPaso.filter(Boolean).map((x, i) => `${i + 1}. ${x}`); break;
      case 3: lines = [`Responsable: ${p[3].responsable}`, `Equipo: ${p[3].equipo.filter(Boolean).join(', ')}`]; break;
      case 4: lines = p[4].herramientas.map((h) => `${h.nombre}: ${fmtMoney(h.costoMensual)}/mes`); break;
      case 5: lines = [`Riesgo: ${p[5].riesgoPrincipal}`, `Mitigación: ${p[5].mitigacion}`, `Probabilidad ${p[5].probabilidad}/5 · Impacto ${p[5].impacto}/5`]; break;
      case 6: lines = p[6].desglose.map((d) => `${d.concepto}: ${fmtMoney(d.monto)}`); break;
      case 7: lines = [`KPI: ${p[7].kpiExito}`, `Fórmula: ${p[7].formulaMedicion}`, `Frecuencia: ${p[7].frecuencia}`]; break;
      case 8: lines = [`Retorno: ${fmtMoney(p[8].retornoEsperado)} en ${p[8].horizonteMeses} meses`, `ROI = (${p[8].retornoEsperado} - ${p[6].inversionEstimada}) / ${p[6].inversionEstimada} = ${fmtPct(p[8].roiProyectado)}`]; break;
    }
    return [`${n}. ${PASO_META[n].titulo}`, lines];
  });
  autoTable(doc, {
    head: [['Paso', 'Detalle']],
    body: sections.map(([a, b]) => [a, b.join('\n')]),
    styles: { fontSize: 9, textColor: 0, lineColor: 0, lineWidth: 0.3, valign: 'top' },
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
    margin: { left: 15, right: 15, bottom: 20 },
  });
  if (t.mediciones.length) {
    autoTable(doc, {
      head: [['Fecha', 'Valor KPI', 'Retorno acumulado', 'Nota']],
      body: t.mediciones.map((m) => [m.fecha, String(m.valorKpi), fmtMoney(m.retornoReal), m.nota]),
      styles: { fontSize: 9, textColor: 0, lineColor: 0, lineWidth: 0.3 },
      headStyles: { fillColor: [255, 230, 0], textColor: [0, 0, 0] },
      margin: { left: 15, right: 15, bottom: 20 },
    });
  }
  footer(doc);
  doc.save(`brief-${slugify(t.nombre) || 'tactica'}-${stamp()}.pdf`);
}

export function briefMarkdown(t: Tactica): string {
  const p = t.pasos;
  return [
    `# ${t.nombre}`,
    `**Estado:** ${ESTADO_LABEL[t.estado]} · **Canal:** ${t.canal || '—'} · **Inicio:** ${t.fechaInicio || 'por definir'}`,
    '',
    `**Inversión:** ${fmtMoney(p[6].inversionEstimada)} · **Retorno:** ${fmtMoney(p[8].retornoEsperado)} · **ROI:** ${fmtPct(p[8].roiProyectado)} · **Horizonte:** ${p[8].horizonteMeses} meses`,
    '',
    `## Evidencia\n${p[1].evidenciaJustifica}\n${p[1].fuentes.filter(Boolean).map((f) => `- ${f}`).join('\n')}`,
    `## Plan\n${p[2].planPasoAPaso.filter(Boolean).map((x, i) => `${i + 1}. ${x}`).join('\n')}`,
    `## Responsable\n${p[3].responsable} — equipo: ${p[3].equipo.filter(Boolean).join(', ')}`,
    `## Herramientas\n${p[4].herramientas.map((h) => `- ${h.nombre} (${fmtMoney(h.costoMensual)}/mes)`).join('\n')}`,
    `## Riesgo (${riskScore(t)}/25)\n${p[5].riesgoPrincipal}\n**Mitigación:** ${p[5].mitigacion}`,
    `## Desglose\n${p[6].desglose.map((d) => `- ${d.concepto}: ${fmtMoney(d.monto)}`).join('\n')}`,
    `## KPI\n${p[7].kpiExito} — ${p[7].formulaMedicion} (${p[7].frecuencia})`,
  ].join('\n');
}
