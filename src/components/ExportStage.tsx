import { useTacticaStore } from '../store/useTacticaStore';
import { EXPORT_NODE_ID } from '../lib/exporters';
import { Matrix, MatrixLegend } from './Matrix';
import { fmtMoney, todayISO } from '../lib/calc';

/** Nodo fuera de pantalla (no display:none) que html-to-image captura para PNG/PDF. */
export function ExportStage() {
  const tacticas = useTacticaStore((s) => s.tacticas);
  const inv = tacticas.reduce((s, t) => s + t.pasos[6].inversionEstimada, 0);
  return (
    <div aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, width: 1200, pointerEvents: 'none' }}>
      <div id={EXPORT_NODE_ID} className="bg-white text-black p-8 border-2 border-black relative" style={{ width: 1200 }}>
        <div className="flex items-end justify-between border-b-2 border-black pb-3 mb-4">
          <div>
            <p className="text-sm font-bold">TÁCTICA ATERRIZADA · {todayISO()}</p>
            <h1 className="text-4xl">Portafolio: ROI × Riesgo</h1>
          </div>
          <p className="text-lg font-bold"><span className="hl">{tacticas.length} tácticas · {fmtMoney(inv)}</span></p>
        </div>
        <Matrix tacticas={tacticas} />
        <div className="mt-4"><MatrixLegend tacticas={tacticas} /></div>
        <span className="absolute bottom-2 right-3 text-xs font-bold" style={{ opacity: 0.6 }}>vilmanunez.com</span>
      </div>
    </div>
  );
}
