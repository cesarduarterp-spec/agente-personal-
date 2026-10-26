import { toCanvas } from 'html-to-image';
import type { Moneda, State } from '../types';
import { cellKey, computeMetrics } from './metrics';
import { generateInsights } from './insights';
import { fmtDate, fmtInt, fmtMoney, fmtPct, slugDate } from './format';
import { downloadBlob, downloadText } from './download';
import { toCSV, toJSON } from './serialize';
import { APP_SLUG } from './persistence';

export const CAPTURE_ID = 'matrix-capture';
const WATERMARK = 'vilmanunez.com';
const COPYRIGHT = '© Vilma Núñez, PhD — Todos los derechos reservados';
const TITLE = 'Cliente × Producto Matrix';

function captureNode(): HTMLElement {
  const node = document.getElementById(CAPTURE_ID);
  if (!node) throw new Error('No se encontró la matriz para capturar. Abre la vista Matriz.');
  return node;
}

/** Captura el canvas principal a 2x y añade la marca de agua en la esquina inferior derecha. */
export async function captureMatrix(): Promise<HTMLCanvasElement> {
  const node = captureNode();
  const canvas = await toCanvas(node, {
    pixelRatio: 2,
    backgroundColor: '#FFFFFF',
    cacheBust: true,
    width: node.scrollWidth,
    height: node.scrollHeight,
    filter: (n) => !(n instanceof HTMLElement && n.dataset.noCapture === 'true'),
  });
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const fs = 22;
    ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
    const w = ctx.measureText(WATERMARK).width;
    const pad = 12;
    const x = canvas.width - w - pad * 2 - 16;
    const y = canvas.height - fs - pad * 2 - 16;
    ctx.fillStyle = '#FFE600';
    ctx.fillRect(x, y, w + pad * 2, fs + pad * 2);
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';
    ctx.fillText(WATERMARK, x + pad, y + pad + 1);
  }
  return canvas;
}

export async function exportPNG(): Promise<void> {
  const canvas = await captureMatrix();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error('No se pudo generar la imagen');
  downloadBlob(blob, `${APP_SLUG}-${slugDate()}.png`);
}

export function exportCSV(data: State): void {
  downloadText(toCSV(data), `${APP_SLUG}-${slugDate()}.csv`, 'text/csv;charset=utf-8');
}

export function exportJSON(data: State): void {
  downloadText(toJSON(data), `${APP_SLUG}-${slugDate()}.json`, 'application/json');
}

/** Las fuentes estándar de jsPDF usan WinAnsi: sustituimos los glifos que no existen. */
const pdfSafe = (s: string) => s.replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[‘’]/g, "'").replace(/[^\u0000-ÿ€—–«»•…×]/g, '');

export async function exportPDF(data: State, moneda: Moneda): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const canvas = await captureMatrix();
  const m = computeMetrics(data);
  const money = (n: number) => fmtMoney(n, moneda);
  const insights = generateInsights(data, m, money);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;

  // ── Portada ──────────────────────────────────────────────
  doc.setFillColor(255, 230, 0);
  doc.rect(0, 0, W, 120, 'F');
  doc.setDrawColor(0);
  doc.setLineWidth(1.2);
  doc.line(0, 120, W, 120);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('INFORME EJECUTIVO · CROSS-SELL', M, 30);
  doc.setFontSize(38);
  doc.text(pdfSafe('Cliente ×'), M, 62);
  doc.text('Producto Matrix', M, 78);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text(pdfSafe(fmtDate(new Date())), M, 100);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const kpis: [string, string][] = [
    ['Ingreso total', money(m.total.ingreso)],
    ['Unidades', fmtInt(m.total.unidades)],
    ['Cobertura de la matriz', fmtPct(m.total.cobertura)],
    ['Índice de cross-sell', `${m.indiceCrossSell.toFixed(2)} productos/avatar`],
    ['Afinidad media (NPS)', m.afinidadMedia === null ? '—' : m.afinidadMedia.toFixed(1)],
    ['Concentración celda top', m.topCelda ? fmtPct(m.topCelda.share) : '—'],
  ];
  let y = 140;
  kpis.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * ((W - M * 2) / 2);
    const yy = y + row * 24;
    doc.setLineWidth(0.6);
    doc.rect(x, yy, (W - M * 2) / 2 - 4, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(pdfSafe(k.toUpperCase()), x + 4, yy + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(pdfSafe(v), x + 4, yy + 15.5);
  });
  y += 3 * 24 + 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${data.avatares.length} avatares · ${data.productos.length} productos · ${m.total.compras} matches activos`, M, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(WATERMARK, M, H - 26);

  // ── Captura del canvas ──────────────────────────────────
  // Página apaisada: la matriz suele ser más ancha que alta.
  doc.addPage('a4', 'landscape');
  const LW = doc.internal.pageSize.getWidth();
  const LH = doc.internal.pageSize.getHeight();
  sectionTitle(doc, 'Matriz Avatar × Producto', M, 22);
  const img = canvas.toDataURL('image/png');
  const maxW = LW - M * 2;
  const maxH = LH - 32 - 20;
  const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
  const iw = canvas.width * ratio;
  const ih = canvas.height * ratio;
  doc.addImage(img, 'PNG', M, 30, iw, ih);
  doc.setLineWidth(0.6);
  doc.rect(M, 30, iw, ih);

  // ── Tabla de datos ──────────────────────────────────────
  doc.addPage('a4', 'portrait');
  sectionTitle(doc, 'Datos por celda', M, 24);
  const body: string[][] = [];
  for (const a of data.avatares) {
    for (const p of data.productos) {
      const c = m.celdaMap.get(cellKey(a.id, p.id));
      if (!c?.compra) continue;
      body.push([
        a.nombre,
        p.nombre,
        fmtInt(c.unidades),
        money(m.ingresoCelda.get(cellKey(a.id, p.id)) ?? 0),
        c.npsDelMatch === undefined ? '—' : String(c.npsDelMatch),
        c.notas ?? '',
      ].map(pdfSafe));
    }
  }
  autoTable(doc, {
    startY: 32,
    margin: { left: M, right: M, bottom: 22 },
    head: [['Avatar', 'Producto', 'Unid.', 'Ingreso', 'NPS', 'Notas']],
    body: body.length ? body : [['Sin compras registradas', '', '', '', '', '']],
    styles: { font: 'helvetica', fontSize: 8.5, textColor: 0, lineColor: 0, lineWidth: 0.3, cellPadding: 2 },
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 230, 0], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'center' }, 5: { cellWidth: 48 } },
  });

  const resumen: string[][] = data.avatares.map((a) => {
    const t = m.porAvatar.get(a.id)!;
    return [a.nombre, fmtInt(a.tamañoSegmento), String(t.compras), fmtPct(t.cobertura), money(t.ingreso)].map(pdfSafe);
  });
  autoTable(doc, {
    margin: { left: M, right: M, bottom: 22 },
    head: [['Avatar', 'Segmento', 'Productos', 'Cobertura', 'Ingreso']],
    body: resumen,
    styles: { font: 'helvetica', fontSize: 8.5, textColor: 0, lineColor: 0, lineWidth: 0.3, cellPadding: 2 },
    headStyles: { fillColor: [255, 230, 0], textColor: 0, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  });

  // ── Insights ────────────────────────────────────────────
  doc.addPage('a4', 'portrait');
  sectionTitle(doc, 'Insights automáticos', M, 24);
  y = 34;
  const tw = W - M * 2 - 10;
  insights.forEach((ins, i) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const t = doc.splitTextToSize(pdfSafe(`${i + 1}. ${ins.titulo}`), tw) as string[];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const ev = doc.splitTextToSize(pdfSafe(`Evidencia: ${ins.evidencia}`), tw) as string[];
    doc.setFont('helvetica', 'bold');
    const ac = doc.splitTextToSize(pdfSafe(`Acción: ${ins.accion}`), tw) as string[];
    const h = t.length * 5 + ev.length * 4.2 + ac.length * 4.2 + 10;
    if (y + h > H - 26) {
      doc.addPage();
      y = 24;
    }
    doc.setLineWidth(0.6);
    doc.rect(M, y, W - M * 2, h);
    doc.setFillColor(ins.severidad === 'alta' ? 0 : 255, ins.severidad === 'alta' ? 0 : 230, ins.severidad === 'alta' ? 0 : 0);
    doc.rect(M, y, 3, h, 'F');
    let yy = y + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(t, M + 6, yy);
    yy += t.length * 5 + 1;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(ev, M + 6, yy);
    yy += ev.length * 4.2 + 1;
    doc.setFont('helvetica', 'bold');
    doc.text(ac, M + 6, yy);
    y += h + 5;
  });
  if (!insights.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Añade avatares y productos para generar el diagnóstico.', M, y);
  }

  // ── Footer en todas las páginas ─────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(M, ph - 14, pw - M, ph - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text(pdfSafe(COPYRIGHT), M, ph - 9);
    doc.text(`${i} / ${pages}`, pw - M, ph - 9, { align: 'right' });
  }

  doc.save(`${APP_SLUG}-informe-${slugDate()}.pdf`);
}

function sectionTitle(doc: import('jspdf').jsPDF, text: string, x: number, y: number) {
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(pdfSafe(text), x, y);
  doc.setFillColor(255, 230, 0);
  doc.rect(x, y + 2.5, 30, 2, 'F');
}

export { TITLE };
