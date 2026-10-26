import { useMemo, type KeyboardEvent } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, GripHorizontal, Pencil, Star } from 'lucide-react';
import type { Avatar, Producto } from '../types';
import { useAppStore } from '../store/useAppStore';
import { useMetrics, useVisible } from '../store/selectors';
import { cellKey, heatBucket } from '../lib/metrics';
import { fmtInt, fmtMoney, fmtPct } from '../lib/format';
import { makeAnnouncements, srInstructions, useDndSensors } from './dnd';

const heatClass = ['bg-white', 'bg-heat1', 'bg-heat2', 'bg-heat3', 'bg-black text-yellow'] as const;

/** Navegación con flechas entre celdas (roving focus sobre data-r / data-c). */
function onGridKey(e: KeyboardEvent<HTMLButtonElement>) {
  const el = e.currentTarget;
  const r = Number(el.dataset.r);
  const c = Number(el.dataset.c);
  const d: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  const delta = d[e.key];
  if (!delta) return;
  const next = document.querySelector<HTMLElement>(`[data-r="${r + delta[0]}"][data-c="${c + delta[1]}"]`);
  if (next) {
    e.preventDefault();
    next.focus();
  }
}

export function MatrixTable({ capture = false }: { capture?: boolean }) {
  const visible = useVisible();
  const all = useAppStore((s) => s.data);
  // La captura exporta siempre la matriz completa, sin filtros ni controles.
  const { avatares, productos } = capture ? all : visible;
  const readOnly = useAppStore((s) => s.readOnly) || capture;
  const moneda = useAppStore((s) => s.moneda);
  const m = useMetrics();
  const { moveAvatar, moveProducto } = useAppStore.getState();
  const sensors = useDndSensors();

  const rowAnn = useMemo(
    () =>
      makeAnnouncements(
        (id) => all.avatares.find((a) => a.id === id)?.nombre ?? 'el avatar',
        (id) => all.avatares.findIndex((a) => a.id === id),
        () => all.avatares.length,
      ),
    [all.avatares],
  );
  const colAnn = useMemo(
    () =>
      makeAnnouncements(
        (id) => all.productos.find((p) => p.id === id)?.nombre ?? 'el producto',
        (id) => all.productos.findIndex((p) => p.id === id),
        () => all.productos.length,
      ),
    [all.productos],
  );

  const onRowEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    moveAvatar(all.avatares.findIndex((a) => a.id === active.id), all.avatares.findIndex((a) => a.id === over.id));
  };
  const onColEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    moveProducto(all.productos.findIndex((p) => p.id === active.id), all.productos.findIndex((p) => p.id === over.id));
  };

  const th = 'border-2 border-black px-2 py-2 text-left align-bottom';
  const totalCell = 'border-2 border-black px-2 py-1 text-right text-xs tabular-nums';

  return (
    <table className="border-collapse text-sm" aria-label="Matriz Avatar por Producto" aria-rowcount={avatares.length + 4}>
      <thead>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onColEnd} accessibility={{ announcements: colAnn, screenReaderInstructions: srInstructions('columna'), container: document.body }}>
          <SortableContext items={productos.map((p) => p.id)} strategy={horizontalListSortingStrategy} disabled={readOnly}>
            <tr>
              <th scope="col" className={`${th} sticky left-0 z-20 min-w-[190px] bg-black text-yellow`}>
                <span className="block text-[11px] uppercase">Avatar ↓ · Producto →</span>
              </th>
              {productos.map((p) => (
                <SortableColHeader key={p.id} producto={p} readOnly={readOnly} />
              ))}
              <th scope="col" className={`${th} min-w-[96px] bg-yellow text-right`}>
                Ingreso
              </th>
              <th scope="col" className={`${th} min-w-[72px] bg-yellow text-right`}>
                Unid.
              </th>
              <th scope="col" className={`${th} min-w-[84px] bg-yellow text-right`}>
                Cobertura
              </th>
            </tr>
          </SortableContext>
        </DndContext>
      </thead>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onRowEnd} accessibility={{ announcements: rowAnn, screenReaderInstructions: srInstructions('fila'), container: document.body }}>
        <SortableContext items={avatares.map((a) => a.id)} strategy={verticalListSortingStrategy} disabled={readOnly}>
          <tbody>
            {avatares.map((a, r) => (
              <SortableRow key={a.id} avatar={a} rowIndex={capture ? -1000 - r : r} productos={productos} readOnly={readOnly} />
            ))}
          </tbody>
        </SortableContext>
      </DndContext>
      <tfoot>
        {(
          [
            ['Ingreso', (id: string) => fmtMoney(m.porProducto.get(id)?.ingreso ?? 0, moneda, true), fmtMoney(m.total.ingreso, moneda, true)],
            ['Unidades', (id: string) => fmtInt(m.porProducto.get(id)?.unidades ?? 0), fmtInt(m.total.unidades)],
            ['Cobertura', (id: string) => fmtPct(m.porProducto.get(id)?.cobertura ?? 0), fmtPct(m.total.cobertura)],
          ] as const
        ).map(([label, fn, tot]) => (
          <tr key={label}>
            <th scope="row" className={`${th} sticky left-0 z-10 bg-yellow py-1 text-xs uppercase`}>
              Total {label.toLowerCase()}
            </th>
            {productos.map((p) => (
              <td key={p.id} className={`${totalCell} bg-white font-bold`}>
                {fn(p.id)}
              </td>
            ))}
            <td colSpan={3} className={`${totalCell} bg-black font-bold text-yellow`}>
              {tot}
            </td>
          </tr>
        ))}
      </tfoot>
    </table>
  );
}

function SortableColHeader({ producto, readOnly }: { producto: Producto; readOnly: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: producto.id });
  const m = useMetrics();
  const moneda = useAppStore((s) => s.moneda);
  const openModal = useAppStore((s) => s.openModal);
  const t = m.porProducto.get(producto.id);
  const huerfano = (t?.compras ?? 0) === 0;
  return (
    <th
      ref={setNodeRef}
      scope="col"
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`border-2 border-black px-2 py-2 text-left align-bottom min-w-[120px] max-w-[170px] ${isDragging ? 'relative z-30 bg-yellow' : 'bg-white'}`}
    >
      <div className="flex items-start gap-1">
        {!readOnly && (
          <button
            ref={setActivatorNodeRef}
            type="button"
            className="-ml-1 flex h-7 w-6 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
            aria-label={`Reordenar producto ${producto.nombre}`}
            data-no-capture="true"
            {...attributes}
            {...listeners}
          >
            <GripHorizontal size={16} aria-hidden />
          </button>
        )}
        <span className="min-w-0 flex-1">
          <span className="block break-words font-display text-[15px] leading-tight">{producto.nombre}</span>
          <span className="mt-1 block text-[11px] font-bold">{fmtMoney(producto.precio, moneda)}</span>
          <span className="block whitespace-nowrap text-[11px]">Cobertura {fmtPct(t?.cobertura ?? 0)}</span>
          {huerfano && <span className="tag mt-1 bg-black text-yellow">Huérfano</span>}
        </span>
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-transparent hover:border-black"
          onClick={() => openModal({ type: 'producto', id: producto.id })}
          aria-label={`Editar producto ${producto.nombre}`}
          data-no-capture="true"
        >
          <Pencil size={14} aria-hidden />
        </button>
      </div>
    </th>
  );
}

function SortableRow({ avatar, rowIndex, productos, readOnly }: { avatar: Avatar; rowIndex: number; productos: Producto[]; readOnly: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: avatar.id });
  const m = useMetrics();
  const moneda = useAppStore((s) => s.moneda);
  const heatmap = useAppStore((s) => s.heatmap);
  const { openModal, selectCell } = useAppStore.getState();
  const t = m.porAvatar.get(avatar.id);
  const mono = t?.compras === 1;
  return (
    <tr ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={isDragging ? 'relative z-30' : undefined}>
      <th scope="row" className={`sticky left-0 z-10 border-2 border-black px-2 py-2 text-left align-middle ${isDragging ? 'bg-yellow' : 'bg-white'}`}>
        <div className="flex items-center gap-1">
          {!readOnly && (
            <button
              ref={setActivatorNodeRef}
              type="button"
              className="-ml-1 flex h-8 w-6 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
              aria-label={`Reordenar avatar ${avatar.nombre}`}
              data-no-capture="true"
              {...attributes}
              {...listeners}
            >
              <GripVertical size={16} aria-hidden />
            </button>
          )}
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[15px] leading-tight">{avatar.nombre}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] font-bold">
              {fmtInt(avatar.tamañoSegmento)} pers.
              {mono && <span className="tag bg-yellow">Mono-producto</span>}
            </span>
          </span>
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-transparent hover:border-black"
            onClick={() => openModal({ type: 'avatar', id: avatar.id })}
            aria-label={`Editar avatar ${avatar.nombre}`}
            data-no-capture="true"
          >
            <Pencil size={14} aria-hidden />
          </button>
        </div>
      </th>
      {productos.map((p, c) => {
        const k = cellKey(avatar.id, p.id);
        const celda = m.celdaMap.get(k);
        const ingreso = m.ingresoCelda.get(k) ?? 0;
        const compra = !!celda?.compra;
        const bucket = heatmap ? heatBucket(ingreso, m.maxIngresoCelda) : 0;
        const perfect = compra && (celda?.npsDelMatch ?? -1) >= 9;
        const bg = heatClass[bucket];
        const label = compra
          ? `${avatar.nombre} × ${p.nombre}: compra, ${celda!.unidades} unidades, ingreso ${fmtMoney(ingreso, moneda)}${celda!.npsDelMatch !== undefined ? `, NPS ${celda!.npsDelMatch}` : ''}. Editar.`
          : `${avatar.nombre} × ${p.nombre}: sin compra, potencial ${fmtMoney(avatar.tamañoSegmento * p.precio, moneda)}. Editar.`;
        return (
          <td key={p.id} className={`h-[76px] border-2 border-black p-0 align-top ${bg}`}>
            <button
              type="button"
              data-cell={k}
              data-r={rowIndex}
              data-c={c}
              onKeyDown={onGridKey}
              onClick={() => selectCell({ avatarId: avatar.id, productoId: p.id })}
              aria-label={label}
              aria-haspopup="dialog"
              className="group relative flex h-full min-h-[76px] w-full flex-col items-start justify-between px-2 py-1.5 text-left hover:outline hover:outline-2 hover:-outline-offset-4 hover:outline-blue"
            >
              {compra ? (
                <>
                  <span className="flex w-full items-center justify-between gap-1">
                    <span className="text-[11px] font-bold">✓ {fmtInt(celda!.unidades)} u</span>
                    {celda!.npsDelMatch !== undefined && (
                      <span
                        className={`inline-flex items-center gap-0.5 border-2 px-1 text-[10px] font-bold leading-4 ${
                          bucket === 4 ? 'border-yellow' : 'border-black'
                        } ${perfect ? (bucket === 4 ? 'bg-yellow text-black' : 'bg-black text-yellow') : ''}`}
                      >
                        {perfect && <Star size={9} aria-hidden fill="currentColor" />}
                        {celda!.npsDelMatch}
                      </span>
                    )}
                  </span>
                  <span className="font-display text-base leading-none tabular-nums">{fmtMoney(ingreso, moneda, true)}</span>
                </>
              ) : (
                <span className="flex h-full w-full items-center justify-center text-lg font-bold" aria-hidden>
                  <span className="opacity-100 group-hover:hidden">·</span>
                  <span className="hidden text-blue group-hover:inline">+</span>
                </span>
              )}
            </button>
          </td>
        );
      })}
      <td className="border-2 border-black bg-white px-2 py-1 text-right font-bold tabular-nums">{fmtMoney(t?.ingreso ?? 0, moneda, true)}</td>
      <td className="border-2 border-black bg-white px-2 py-1 text-right tabular-nums">{fmtInt(t?.unidades ?? 0)}</td>
      <td className="border-2 border-black bg-white px-2 py-1 text-right tabular-nums">{fmtPct(t?.cobertura ?? 0)}</td>
    </tr>
  );
}
