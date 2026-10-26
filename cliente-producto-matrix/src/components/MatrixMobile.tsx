import { MoreVertical, Pencil, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useMetrics, useVisible } from '../store/selectors';
import { cellKey, heatBucket } from '../lib/metrics';
import { fmtInt, fmtMoney, fmtPct } from '../lib/format';
import { MoveToMenu } from './MoveToMenu';

const heatClass = ['bg-white', 'bg-heat1', 'bg-heat2', 'bg-heat3', 'bg-black text-yellow'] as const;

/** Vista < 768 px: cada avatar es una tarjeta apilada; DnD degrada a "Mover a…". */
export function MatrixMobile() {
  const { avatares, productos } = useVisible();
  const all = useAppStore((s) => s.data);
  const readOnly = useAppStore((s) => s.readOnly);
  const moneda = useAppStore((s) => s.moneda);
  const heatmap = useAppStore((s) => s.heatmap);
  const m = useMetrics();
  const { moveAvatar, moveProducto, openModal, selectCell, confirm, removeAvatar, removeProducto, toast } = useAppStore.getState();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <section aria-labelledby="mob-productos" className="card">
        <h2 id="mob-productos" className="border-b-2 border-black bg-yellow px-3 py-2 text-lg">
          Productos ({productos.length})
        </h2>
        <ul className="divide-y-2 divide-black">
          {productos.map((p) => {
            const t = m.porProducto.get(p.id);
            const idx = all.productos.findIndex((x) => x.id === p.id);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base leading-tight">{p.nombre}</p>
                  <p className="text-xs font-bold">
                    {fmtMoney(p.precio, moneda)} · {fmtPct(t?.cobertura ?? 0)} cobertura · {fmtMoney(t?.ingreso ?? 0, moneda, true)}
                    {(t?.compras ?? 0) === 0 && <span className="tag ml-1 bg-black text-yellow">Huérfano</span>}
                  </p>
                </div>
                {!readOnly && (
                  <>
                    <MoveToMenu index={idx} total={all.productos.length} label={p.nombre} onMove={(to) => { moveProducto(idx, to); toast(`${p.nombre} movido a la posición ${to + 1}`); }} />
                    <button type="button" className="btn btn-icon min-h-[36px]" aria-label={`Editar ${p.nombre}`} onClick={() => openModal({ type: 'producto', id: p.id })}>
                      <Pencil size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon min-h-[36px]"
                      aria-label={`Eliminar ${p.nombre}`}
                      onClick={() =>
                        confirm({
                          title: 'Eliminar producto',
                          message: `Se eliminará «${p.nombre}» y todas sus celdas.`,
                          onConfirm: () => removeProducto(p.id),
                        })
                      }
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {avatares.map((a) => {
        const t = m.porAvatar.get(a.id);
        const idx = all.avatares.findIndex((x) => x.id === a.id);
        return (
          <section key={a.id} aria-labelledby={`mob-a-${a.id}`} className="card">
            <header className="flex items-start gap-2 border-b-2 border-black px-3 py-2">
              <div className="min-w-0 flex-1">
                <h2 id={`mob-a-${a.id}`} className="text-lg leading-tight">
                  {a.nombre}
                </h2>
                <p className="text-xs font-bold">
                  {fmtInt(a.tamañoSegmento)} pers. · {fmtMoney(t?.ingreso ?? 0, moneda)} · {fmtInt(t?.unidades ?? 0)} u · {fmtPct(t?.cobertura ?? 0)}
                  {t?.compras === 1 && <span className="tag ml-1 bg-yellow">Mono-producto</span>}
                </p>
              </div>
              {!readOnly && (
                <div className="relative">
                  <button
                    type="button"
                    className="btn btn-icon min-h-[36px]"
                    aria-label={`Opciones de ${a.nombre}`}
                    aria-expanded={openMenu === a.id}
                    onClick={() => setOpenMenu(openMenu === a.id ? null : a.id)}
                  >
                    <MoreVertical size={16} aria-hidden />
                  </button>
                  {openMenu === a.id && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-56 space-y-2 border-2 border-black bg-white p-2 shadow-brutal">
                      <MoveToMenu index={idx} total={all.avatares.length} label={a.nombre} onMove={(to) => { moveAvatar(idx, to); setOpenMenu(null); toast(`${a.nombre} movido a la posición ${to + 1}`); }} />
                      <button type="button" className="btn w-full justify-start" onClick={() => { setOpenMenu(null); openModal({ type: 'avatar', id: a.id }); }}>
                        <Pencil size={14} aria-hidden /> Editar
                      </button>
                      <button
                        type="button"
                        className="btn w-full justify-start"
                        onClick={() => {
                          setOpenMenu(null);
                          confirm({ title: 'Eliminar avatar', message: `Se eliminará «${a.nombre}» y todas sus celdas.`, onConfirm: () => removeAvatar(a.id) });
                        }}
                      >
                        <Trash2 size={14} aria-hidden /> Eliminar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </header>
            <ul className="grid grid-cols-2 gap-0">
              {productos.map((p, i) => {
                const k = cellKey(a.id, p.id);
                const celda = m.celdaMap.get(k);
                const ingreso = m.ingresoCelda.get(k) ?? 0;
                const compra = !!celda?.compra;
                const bucket = heatmap ? heatBucket(ingreso, m.maxIngresoCelda) : 0;
                return (
                  <li key={p.id} className={`border-black ${i % 2 === 0 ? 'border-r-2' : ''} ${i >= 2 ? 'border-t-2' : ''}`}>
                    <button
                      type="button"
                      data-cell={k}
                      onClick={() => selectCell({ avatarId: a.id, productoId: p.id })}
                      className={`flex min-h-[64px] w-full flex-col items-start justify-between px-2 py-1.5 text-left ${heatClass[bucket]}`}
                      aria-label={`${p.nombre}: ${compra ? `${celda!.unidades} unidades, ${fmtMoney(ingreso, moneda)}` : 'sin compra'}. Editar.`}
                    >
                      <span className="line-clamp-2 text-xs font-bold leading-tight">{p.nombre}</span>
                      {compra ? (
                        <span className="flex w-full items-end justify-between">
                          <span className="font-display text-base leading-none">{fmtMoney(ingreso, moneda, true)}</span>
                          {celda!.npsDelMatch !== undefined && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold">
                              {celda!.npsDelMatch >= 9 && <Star size={10} fill="currentColor" aria-hidden />}NPS {celda!.npsDelMatch}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-blue">+ Añadir</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="card bg-black p-3 text-yellow on-dark" aria-label="Totales">
        <p className="text-xs font-bold uppercase">Totales</p>
        <p className="font-display text-2xl">{fmtMoney(m.total.ingreso, moneda)}</p>
        <p className="text-xs font-bold">
          {fmtInt(m.total.unidades)} unidades · {fmtPct(m.total.cobertura)} cobertura
        </p>
      </section>
    </div>
  );
}
