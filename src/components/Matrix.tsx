import { useState } from 'react';
import type { Tactica } from '../lib/schema';
import { ESTADO_LABEL } from '../lib/schema';
import { fmtMoney, fmtPct, riskScore } from '../lib/calc';

const W = 800, H = 480, PAD = { l: 64, r: 24, t: 24, b: 56 };
const FILL: Record<Tactica['estado'], string> = { draft: '#FFFFFF', aprobada: '#FFE600', ejecutando: '#0047FF', medida: '#000000' };

interface Props {
  tacticas: Tactica[];
  onSelect?: (id: string) => void;
  watermark?: boolean;
}

/** Matriz ROI proyectado (Y) × Riesgo prob×impacto (X). Tamaño = inversión. SVG con viewBox: escala en cualquier ancho. */
export function Matrix({ tacticas, onSelect, watermark }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const pts = tacticas.filter((t) => t.pasos[6].inversionEstimada > 0);
  const rois = pts.map((t) => t.pasos[8].roiProyectado);
  const yMin = Math.min(-0.5, ...rois) - 0.1;
  const yMax = Math.max(1, ...rois) + 0.1;
  const maxInv = Math.max(1, ...pts.map((t) => t.pasos[6].inversionEstimada));
  const x = (r: number) => PAD.l + (r / 25) * (W - PAD.l - PAD.r);
  const y = (roi: number) => PAD.t + ((yMax - roi) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const rad = (inv: number) => 10 + Math.sqrt(inv / maxInv) * 26;
  const yTicks = Array.from({ length: 6 }, (_, i) => yMin + ((yMax - yMin) * i) / 5);
  const h = pts.find((t) => t.id === hover);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" role="group" aria-label="Matriz de tácticas: ROI proyectado frente a riesgo" style={{ fontFamily: 'Inter, sans-serif' }}>
      <rect x="0" y="0" width={W} height={H} fill="#FFFFFF" />
      {/* cuadrantes */}
      <rect x={PAD.l} y={PAD.t} width={x(12.5) - PAD.l} height={y(0) - PAD.t} fill="#FFE600" opacity="0.35" />
      <g fontSize="13" fontWeight="700" fill="#000">
        <text x={PAD.l + 8} y={PAD.t + 18}>APOSTAR · bajo riesgo, ROI +</text>
        <text x={W - PAD.r - 8} y={PAD.t + 18} textAnchor="end">BLINDAR · alto riesgo, ROI +</text>
        <text x={PAD.l + 8} y={H - PAD.b - 10}>OPTIMIZAR · bajo riesgo, ROI −</text>
        <text x={W - PAD.r - 8} y={H - PAD.b - 10} textAnchor="end">DESCARTAR · alto riesgo, ROI −</text>
      </g>
      {/* ejes */}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="#000" strokeWidth="2" />
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="#000" strokeWidth="2" />
      <line x1={PAD.l} y1={y(0)} x2={W - PAD.r} y2={y(0)} stroke="#000" strokeWidth="2" strokeDasharray="6 4" />
      <line x1={x(12.5)} y1={PAD.t} x2={x(12.5)} y2={H - PAD.b} stroke="#000" strokeWidth="1" strokeDasharray="4 4" />
      <g fontSize="12" fill="#000">
        {yTicks.map((v) => (
          <text key={v} x={PAD.l - 8} y={y(v) + 4} textAnchor="end">{Math.round(v * 100)}%</text>
        ))}
        {[0, 5, 10, 15, 20, 25].map((v) => (
          <text key={v} x={x(v)} y={H - PAD.b + 18} textAnchor="middle">{v}</text>
        ))}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 12} textAnchor="middle" fontWeight="700">Riesgo (probabilidad × impacto)</text>
        <text transform={`translate(16 ${(PAD.t + H - PAD.b) / 2}) rotate(-90)`} textAnchor="middle" fontWeight="700">ROI proyectado</text>
      </g>
      {/* burbujas */}
      {[...pts].sort((a, b) => b.pasos[6].inversionEstimada - a.pasos[6].inversionEstimada).map((t, i) => {
        const cx = x(riskScore(t)), cy = y(t.pasos[8].roiProyectado), r = rad(t.pasos[6].inversionEstimada);
        const fill = FILL[t.estado];
        const label = `${t.nombre}: ROI ${fmtPct(t.pasos[8].roiProyectado)}, riesgo ${riskScore(t)} de 25, inversión ${fmtMoney(t.pasos[6].inversionEstimada)}, ${ESTADO_LABEL[t.estado]}`;
        return (
          <g
            key={t.id}
            role={onSelect ? 'button' : 'img'}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={label}
            className={onSelect ? 'cursor-pointer outline-none' : ''}
            onPointerEnter={() => setHover(t.id)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(t.id)}
            onBlur={() => setHover(null)}
            onClick={() => onSelect?.(t.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect?.(t.id))}
          >
            <circle cx={cx} cy={cy} r={r} fill={fill} stroke="#000" strokeWidth={hover === t.id ? 4 : 2} />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill={fill === '#FFFFFF' || fill === '#FFE600' ? '#000' : '#FFF'}>{i + 1}</text>
          </g>
        );
      })}
      {h && (() => {
        const cx = x(riskScore(h)), cy = y(h.pasos[8].roiProyectado);
        const bw = 260, bx = Math.min(W - PAD.r - bw, Math.max(PAD.l, cx + 20)), by = Math.max(PAD.t, Math.min(H - PAD.b - 64, cy - 32));
        return (
          <g pointerEvents="none">
            <rect x={bx} y={by} width={bw} height={64} fill="#FFF" stroke="#000" strokeWidth="2" />
            <text x={bx + 10} y={by + 20} fontSize="13" fontWeight="700">{h.nombre.length > 34 ? h.nombre.slice(0, 33) + '…' : h.nombre}</text>
            <text x={bx + 10} y={by + 38} fontSize="12">ROI {fmtPct(h.pasos[8].roiProyectado)} · riesgo {riskScore(h)}/25</text>
            <text x={bx + 10} y={by + 54} fontSize="12">{fmtMoney(h.pasos[6].inversionEstimada)} · {ESTADO_LABEL[h.estado]}</text>
          </g>
        );
      })()}
      {pts.length === 0 && (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="16" fontWeight="700">Completa el paso 6 (inversión) para ver tácticas aquí</text>
      )}
      {watermark && <text x={W - 10} y={H - 6} textAnchor="end" fontSize="11" fill="#000" opacity="0.55">vilmanunez.com</text>}
    </svg>
  );
}

export function MatrixLegend({ tacticas }: { tacticas: Tactica[] }) {
  const pts = [...tacticas.filter((t) => t.pasos[6].inversionEstimada > 0)].sort((a, b) => b.pasos[6].inversionEstimada - a.pasos[6].inversionEstimada);
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap gap-3 text-xs font-bold">
        {(Object.keys(FILL) as Tactica['estado'][]).map((e) => (
          <span key={e} className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 border-2 border-black" style={{ background: FILL[e] }} aria-hidden />
            {ESTADO_LABEL[e]}
          </span>
        ))}
        <span>· Tamaño = inversión</span>
      </div>
      <ol className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
        {pts.map((t, i) => (
          <li key={t.id} className="flex gap-2"><span className="font-bold w-5 text-right">{i + 1}.</span><span className="truncate">{t.nombre}</span></li>
        ))}
      </ol>
    </div>
  );
}
