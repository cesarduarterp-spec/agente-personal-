import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import type { Estado, Tactica } from '../lib/schema';
import { ESTADO_LABEL, ESTADOS } from '../lib/schema';
import { TacticaCard } from '../components/TacticaCard';
import { useTacticaActions } from '../hooks/useTacticaActions';

const HINT: Record<Estado, string> = {
  draft: 'Ideas en construcción',
  aprobada: 'Validadas 8/8, listas',
  ejecutando: 'En marcha, registrar KPIs',
  medida: 'Con resultados reales',
};

/** Flechas izquierda/derecha saltan entre columnas; arriba/abajo también (columnas apiladas). */
const columnCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.code];
  if (!dir) return undefined;
  event.preventDefault();
  const cols = ESTADOS.map((e) => ({ e, rect: context.droppableRects.get(`col-${e}`) })).filter(
    (c): c is { e: Estado; rect: NonNullable<typeof c.rect> } => !!c.rect,
  );
  const overId = context.over?.id ?? `col-${(context.active?.data.current as { estado?: Estado } | undefined)?.estado}`;
  const idx = Math.max(0, cols.findIndex((c) => `col-${c.e}` === overId));
  const target = cols[Math.min(cols.length - 1, Math.max(0, idx + dir))];
  if (!target) return currentCoordinates;
  return { x: target.rect.left + 12, y: target.rect.top + 56 };
};

function Column({ estado, items, readOnly }: { estado: Estado; items: Tactica[]; readOnly: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${estado}`, data: { estado } });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`h-${estado}`}
      className={`border-2 border-black rounded-sm flex flex-col min-h-[180px] ${isOver ? 'bg-yellow' : 'bg-white'}`}
    >
      <header className="border-b-2 border-black px-3 py-2 flex items-baseline justify-between gap-2">
        <h2 id={`h-${estado}`} className="text-lg">{ESTADO_LABEL[estado]}</h2>
        <span className="chip bg-black text-white">{items.length}</span>
      </header>
      <p className="px-3 pt-2 text-xs font-bold">{HINT[estado]}</p>
      <ul className="flex flex-col gap-2 p-2" role="list">
        {items.map((t) => (
          <li key={t.id}><DraggableCard t={t} readOnly={readOnly} /></li>
        ))}
        {items.length === 0 && <li className="border-2 border-dashed border-black p-3 text-xs font-bold">Suelta aquí</li>}
      </ul>
    </section>
  );
}

function DraggableCard({ t, readOnly }: { t: Tactica; readOnly: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: t.id,
    data: { estado: t.estado, nombre: t.nombre },
    disabled: readOnly,
  });
  return (
    <div ref={setNodeRef} className={isDragging ? 'opacity-40' : ''}>
      <TacticaCard t={t} readOnly={readOnly} dragHandle={{ attributes, listeners, setActivatorNodeRef }} />
    </div>
  );
}

export function Board({ tacticas, readOnly }: { tacticas: Tactica[]; readOnly: boolean }) {
  const { move } = useTacticaActions();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: columnCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Enter', 'Space'] },
    }),
  );
  const byEstado = useMemo(() => {
    const m: Record<Estado, Tactica[]> = { draft: [], aprobada: [], ejecutando: [], medida: [] };
    for (const t of tacticas) m[t.estado].push(t);
    return m;
  }, [tacticas]);
  const name = (id: string | number) => tacticas.find((t) => t.id === id)?.nombre ?? 'táctica';
  const col = (id?: string | number) => (id ? ESTADO_LABEL[String(id).replace('col-', '') as Estado] : undefined);

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Tomaste «${name(active.id)}». Usa las flechas para cambiar de columna, Enter para soltar, Escape para cancelar.`,
    onDragOver: ({ active, over }) => (over ? `«${name(active.id)}» sobre la columna ${col(over.id)}.` : `«${name(active.id)}» fuera de columnas.`),
    onDragEnd: ({ active, over }) => (over ? `«${name(active.id)}» soltada en ${col(over.id)}.` : `«${name(active.id)}» soltada sin cambios.`),
    onDragCancel: ({ active }) => `Movimiento de «${name(active.id)}» cancelado.`,
  };

  const onEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const to = e.over?.data.current?.estado as Estado | undefined;
    const from = e.active.data.current?.estado as Estado | undefined;
    if (to && to !== from) move(String(e.active.id), to);
  };
  const active = tacticas.find((t) => t.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={onEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'Para mover una táctica pulsa Espacio. Usa las flechas para cambiar de columna, Enter para soltar y Escape para cancelar.',
        },
      }}
    >
      <div id="board" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {ESTADOS.map((e) => <Column key={e} estado={e} items={byEstado[e]} readOnly={readOnly} />)}
      </div>
      <DragOverlay>{active ? <TacticaCard t={active} readOnly dragging /> : null}</DragOverlay>
    </DndContext>
  );
}
