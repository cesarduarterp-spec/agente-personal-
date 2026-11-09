import { useMemo } from 'react';
import type { Estado, Tactica } from '../lib/schema';
import { ESTADO_LABEL } from '../lib/schema';
import { useTacticaStore } from '../store/useTacticaStore';
import { useUiStore } from '../store/useUiStore';

/** Acciones de alto nivel con confirmaciones y toasts (la lógica pura vive en el store). */
export function useTacticaActions() {
  return useMemo(() => {
    const ui = () => useUiStore.getState();
    const st = () => useTacticaStore.getState();
    return {
      create: () => {
        const id = st().addTactica();
        if (id) ui().openEditor(id);
        else ui().toast('Estás viendo un snapshot: duplícalo para editar', 'error');
      },
      edit: (id: string) => ui().openEditor(id),
      duplicate: (id: string) => {
        if (st().duplicateTactica(id)) ui().toast('Táctica duplicada como borrador');
      },
      remove: async (t: Tactica) => {
        const ok = await ui().ask({
          title: 'Eliminar táctica',
          body: `Vas a eliminar «${t.nombre}». Puedes deshacerlo con Ctrl/Cmd+Z.`,
          confirmLabel: 'Eliminar',
        });
        if (!ok) return;
        st().removeTactica(t.id);
        if (ui().editingId === t.id) ui().openEditor(null);
        ui().toast(`«${t.nombre}» eliminada`);
      },
      move: (id: string, estado: Estado) => {
        const r = st().setEstado(id, estado);
        if (r.ok) ui().toast(`Movida a ${ESTADO_LABEL[estado]}`);
        else ui().toast(r.error, 'error');
        return r.ok;
      },
      loadSample: () => {
        st().loadSample();
        ui().toast('Caso de ejemplo cargado: Tueste Norte (café DTC)');
      },
      reset: async () => {
        const first = await ui().ask({
          title: 'Resetear todo',
          body: 'Se borrarán todas las tácticas de este navegador. Exporta un JSON antes si lo necesitas.',
          confirmLabel: 'Continuar',
        });
        if (!first) return;
        const second = await ui().ask({
          title: 'Confirmación final',
          body: 'Esta es la segunda confirmación. Tras borrar solo podrás recuperar con Deshacer en esta sesión.',
          confirmLabel: 'Borrar todo',
          requireText: 'BORRAR',
        });
        if (!second) return;
        st().reset();
        ui().openEditor(null);
        ui().clearFilters();
        ui().toast('Datos borrados');
      },
    };
  }, []);
}
