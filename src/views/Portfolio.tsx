import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { Tactica } from '../lib/schema';
import { ESTADO_LABEL, pasosValidos } from '../lib/schema';
import { fmtMoney, fmtPct, riskLevel, riskScore, roiReal } from '../lib/calc';
import { Matrix, MatrixLegend } from '../components/Matrix';
import { useUiStore } from '../store/useUiStore';

type SortKey = 'nombre' | 'roi' | 'riesgo' | 'inversion' | 'retorno' | 'real';
const getters: Record<SortKey, (t: Tactica) => number | string> = {
  nombre: (t) => t.nombre.toLowerCase(),
  roi: (t) => t.pasos[8].roiProyectado,
  riesgo: riskScore,
  inversion: (t) => t.pasos[6].inversionEstimada,
  retorno: (t) => t.pasos[8].retornoEsperado,
  real: (t) => roiReal(t) ?? -Infinity,
};

export function Portfolio({ tacticas }: { tacticas: Tactica[] }) {
  const open = useUiStore((s) => s.openEditor);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'roi', dir: -1 });
  const rows = useMemo(() => {
    const g = getters[sort.key];
    return [...tacticas].sort((a, b) => {
      const va = g(a), vb = g(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [tacticas, sort]);

  const Th = ({ k, children, num }: { k: SortKey; children: string; num?: boolean }) => {
    const active = sort.key === k;
    return (
      <th scope="col" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={`p-0 ${num ? 'text-right' : 'text-left'}`}>
        <button
          className={`w-full px-2 py-2 font-bold inline-flex items-center gap-1 ${num ? 'justify-end' : ''} ${active ? 'bg-yellow text-black' : ''}`}
          onClick={() => setSort({ key: k, dir: active ? ((-sort.dir) as 1 | -1) : k === 'nombre' ? 1 : -1 })}
        >
          {children}
          {active && (sort.dir === 1 ? <ArrowUp size={14} aria-hidden /> : <ArrowDown size={14} aria-hidden />)}
        </button>
      </th>
    );
  };

  const totInv = tacticas.reduce((s, t) => s + t.pasos[6].inversionEstimada, 0);
  const totRet = tacticas.reduce((s, t) => s + t.pasos[8].retornoEsperado, 0);
  const roiPort = totInv > 0 ? (totRet - totInv) / totInv : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Tácticas', String(tacticas.length)],
          ['Inversión total', fmtMoney(totInv)],
          ['Retorno esperado', fmtMoney(totRet)],
          ['ROI del portafolio', totInv ? fmtPct(roiPort) : '—'],
        ].map(([k, v]) => (
          <div key={k} className="card p-3">
            <p className="text-xs font-bold">{k}</p>
            <p className={`font-display text-2xl ${k === 'ROI del portafolio' && roiPort < 0 ? 'text-red' : ''}`}>{v}</p>
          </div>
        ))}
      </div>

      <section id="canvas-principal" className="card p-3" aria-labelledby="matrix-h">
        <h2 id="matrix-h" className="text-xl mb-2">Matriz ROI × Riesgo</h2>
        <Matrix tacticas={tacticas} onSelect={open} watermark />
        <div className="mt-3"><MatrixLegend tacticas={tacticas} /></div>
      </section>

      <section className="card" aria-labelledby="tabla-h">
        <h2 id="tabla-h" className="text-xl px-3 pt-3">Comparativa por ROI y riesgo</h2>
        <div className="overflow-x-auto p-3">
          <table className="w-full min-w-[760px] border-2 border-black text-sm">
            <thead className="bg-black text-white">
              <tr>
                <Th k="nombre">Táctica</Th>
                <th scope="col" className="text-left px-2">Estado</th>
                <th scope="col" className="text-left px-2">Canal</th>
                <Th k="inversion" num>Inversión</Th>
                <Th k="retorno" num>Retorno</Th>
                <Th k="roi" num>ROI proy.</Th>
                <Th k="real" num>ROI real</Th>
                <Th k="riesgo" num>Riesgo</Th>
                <th scope="col" className="text-right px-2">Pasos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const roi = t.pasos[8].roiProyectado, has = t.pasos[6].inversionEstimada > 0, real = roiReal(t);
                return (
                  <tr key={t.id} className="border-t-2 border-black hover:bg-yellow">
                    <th scope="row" className="text-left px-2 py-2">
                      <button className="text-left font-bold underline text-blue hover:text-black" onClick={() => open(t.id)}>{t.nombre}</button>
                    </th>
                    <td className="px-2">{ESTADO_LABEL[t.estado]}</td>
                    <td className="px-2">{t.canal || '—'}</td>
                    <td className="px-2 text-right tabular-nums">{has ? fmtMoney(t.pasos[6].inversionEstimada) : '—'}</td>
                    <td className="px-2 text-right tabular-nums">{fmtMoney(t.pasos[8].retornoEsperado)}</td>
                    <td className={`px-2 text-right tabular-nums font-bold ${has && roi < 0 ? 'text-red' : ''}`}>{has ? fmtPct(roi) : '—'}</td>
                    <td className="px-2 text-right tabular-nums">{real === null ? '—' : fmtPct(real)}</td>
                    <td className="px-2 text-right tabular-nums">{riskScore(t) ? `${riskScore(t)} · ${riskLevel(t)}` : '—'}</td>
                    <td className="px-2 text-right tabular-nums">{pasosValidos(t).length}/8</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
