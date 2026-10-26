import { useMemo, useState } from 'react';
import { Target, Trophy } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useMetrics } from '../store/selectors';
import { cellKey } from '../lib/metrics';
import { fmtInt, fmtMoney } from '../lib/format';
import { EmptyState } from './EmptyState';

const PAGE = 25;

export function OpportunitiesView() {
  const m = useMetrics();
  const data = useAppStore((s) => s.data);
  const query = useAppStore((s) => s.filtros.query);
  const soloMono = useAppStore((s) => s.filtros.soloMono);
  const moneda = useAppStore((s) => s.moneda);
  const readOnly = useAppStore((s) => s.readOnly);
  const { selectCell, setView } = useAppStore.getState();
  const [avatarId, setAvatarId] = useState('');
  const [productoId, setProductoId] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return m.oportunidades.filter(
      (o) =>
        (!q || o.avatar.nombre.toLowerCase().includes(q) || o.producto.nombre.toLowerCase().includes(q)) &&
        (!avatarId || o.avatar.id === avatarId) &&
        (!productoId || o.producto.id === productoId) &&
        (!soloMono || m.porAvatar.get(o.avatar.id)?.compras === 1),
    );
  }, [m, query, avatarId, productoId, soloMono]);

  if (!data.avatares.length || !data.productos.length) {
    return (
      <EmptyState
        icon={<Target size={28} aria-hidden />}
        title="Aún no hay oportunidades que calcular"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setView('matriz')}>
            Ir a la matriz
          </button>
        }
      >
        Las oportunidades son las celdas vacías ordenadas por potencial (tamaño del segmento × precio). Crea avatares y productos primero.
      </EmptyState>
    );
  }
  if (!m.oportunidades.length) {
    return (
      <EmptyState icon={<Trophy size={28} aria-hidden />} title="Cobertura del 100%">
        Todos tus avatares compran todos tus productos. Ahora la palanca es profundidad: más unidades y mejor NPS por match.
      </EmptyState>
    );
  }

  const max = list[0]?.potencial ?? 1;
  const totalPot = list.reduce((s, o) => s + o.potencial, 0);

  return (
    <section aria-labelledby="ops-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="ops-title" className="text-2xl">
            Oportunidades de cross-sell
          </h2>
          <p className="text-sm">
            {list.length} celdas vacías · potencial total <strong>{fmtMoney(totalPot, moneda)}</strong> (segmento × precio)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div>
            <label htmlFor="op-avatar" className="label">
              Avatar
            </label>
            <select id="op-avatar" className="field w-auto" value={avatarId} onChange={(e) => setAvatarId(e.target.value)}>
              <option value="">Todos</option>
              {data.avatares.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="op-producto" className="label">
              Producto
            </label>
            <select id="op-producto" className="field w-auto" value={productoId} onChange={(e) => setProductoId(e.target.value)}>
              <option value="">Todos</option>
              {data.productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="card p-4 text-sm font-bold">Ninguna oportunidad coincide con los filtros actuales.</p>
      ) : (
        <ol className="card divide-y-2 divide-black">
          {list.slice(0, limit).map((o, i) => {
            const k = cellKey(o.avatar.id, o.producto.id);
            const ratio = max > 0 ? o.potencial / max : 0;
            const mono = m.porAvatar.get(o.avatar.id)?.compras === 1;
            return (
              <li key={k} className="grid grid-cols-[2.5rem_1fr] gap-x-3 gap-y-2 p-3 sm:grid-cols-[3rem_1fr_auto] sm:items-center">
                <span className={`flex h-10 w-10 items-center justify-center border-2 border-black font-display text-lg ${i < 3 ? 'bg-yellow' : 'bg-white'}`} aria-label={`Puesto ${i + 1}`}>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-display text-base leading-tight">
                    {o.avatar.nombre} <span aria-hidden>×</span>
                    <span className="sr-only">por</span> {o.producto.nombre}
                  </p>
                  <p className="text-xs">
                    {fmtInt(o.avatar.tamañoSegmento)} pers. × {fmtMoney(o.producto.precio, moneda)} ={' '}
                    <strong className="text-sm">{fmtMoney(o.potencial, moneda)}</strong>
                    {o.npsProducto !== null && <> · NPS medio del producto {o.npsProducto.toFixed(1)}</>}
                    {mono && <span className="tag ml-1 bg-yellow">Mono-producto</span>}
                  </p>
                  <div className="mt-1 h-2 w-full border-2 border-black" aria-hidden>
                    <div className="h-full bg-black" style={{ width: `${Math.max(2, ratio * 100)}%` }} />
                  </div>
                </div>
                <button
                  type="button"
                  data-cell={k}
                  className="btn col-span-2 sm:col-span-1"
                  disabled={readOnly}
                  onClick={() => selectCell({ avatarId: o.avatar.id, productoId: o.producto.id })}
                >
                  Registrar compra
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {list.length > limit && (
        <button type="button" className="btn w-full" onClick={() => setLimit((l) => l + PAGE)}>
          Ver {Math.min(PAGE, list.length - limit)} más
        </button>
      )}
    </section>
  );
}
