import { KeyboardSensor, PointerSensor, useSensor, useSensors, type Announcements, type ScreenReaderInstructions } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

export function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Space toma, flechas mueven, Enter suelta, Escape cancela.
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Enter', 'Space'] },
    }),
  );
}

export const srInstructions = (eje: 'fila' | 'columna'): ScreenReaderInstructions => ({
  draggable: `Para reordenar esta ${eje}, pulsa Espacio para tomarla, usa las flechas para moverla, Enter para soltarla o Escape para cancelar.`,
});

/** Anuncios aria-live en español para lectores de pantalla. */
export function makeAnnouncements(nameOf: (id: string) => string, indexOf: (id: string) => number, total: () => number): Announcements {
  const pos = (id: string) => `posición ${indexOf(id) + 1} de ${total()}`;
  return {
    onDragStart: ({ active }) => `Has tomado ${nameOf(String(active.id))}, en ${pos(String(active.id))}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(String(active.id))} se moverá a la ${pos(String(over.id))}.` : `${nameOf(String(active.id))} no está sobre una posición válida.`,
    onDragEnd: ({ active, over }) =>
      over ? `${nameOf(String(active.id))} soltado en la ${pos(String(over.id))}.` : `${nameOf(String(active.id))} soltado.`,
    onDragCancel: ({ active }) => `Movimiento cancelado. ${nameOf(String(active.id))} vuelve a su sitio.`,
  };
}
