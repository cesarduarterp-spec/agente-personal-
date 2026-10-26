import { useAppStore } from '../store/useAppStore';
import { useMetrics } from '../store/selectors';
import { fmtInt, fmtMoney, fmtPct } from '../lib/format';

export function Kpis() {
  const m = useMetrics();
  const moneda = useAppStore((s) => s.moneda);
  const items: { label: string; value: string; hint: string }[] = [
    { label: 'Ingreso total', value: fmtMoney(m.total.ingreso, moneda), hint: 'Σ unidades × precio' },
    { label: 'Unidades', value: fmtInt(m.total.unidades), hint: 'en celdas con compra' },
    { label: 'Cobertura', value: fmtPct(m.total.cobertura), hint: `${m.total.compras} matches activos` },
    { label: 'Índice cross-sell', value: m.indiceCrossSell.toFixed(2), hint: 'productos por avatar comprador' },
    { label: 'Afinidad', value: m.afinidadMedia === null ? '—' : m.afinidadMedia.toFixed(1), hint: 'NPS medio ponderado' },
    { label: 'Concentración', value: m.topCelda ? fmtPct(m.topCelda.share) : '—', hint: 'ingreso en la celda top' },
  ];
  return (
    <dl className="grid grid-cols-2 border-l-2 border-t-2 border-black sm:grid-cols-3 xl:grid-cols-6">
      {items.map((i) => (
        <div key={i.label} className="border-b-2 border-r-2 border-black px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-wide">{i.label}</dt>
          <dd className="font-display text-2xl leading-tight">{i.value}</dd>
          <dd className="text-[11px]">{i.hint}</dd>
        </div>
      ))}
    </dl>
  );
}
