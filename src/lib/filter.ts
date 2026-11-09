import type { Tactica } from './schema';
import { tacticaCompleta } from './schema';
import { riskLevel } from './calc';
import type { Filters } from '../store/useUiStore';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterTacticas(ts: Tactica[], search: string, f: Filters): Tactica[] {
  const q = norm(search.trim());
  return ts.filter((t) => {
    if (q) {
      const hay = norm(
        [t.nombre, t.canal, t.pasos[3].responsable, t.pasos[5].riesgoPrincipal, t.pasos[7].kpiExito].join(' '),
      );
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    if (f.estados.length && !f.estados.includes(t.estado)) return false;
    if (f.canal && t.canal.trim() !== f.canal) return false;
    if (f.riesgo && riskLevel(t) !== f.riesgo) return false;
    if (f.soloRoiNegativo && !(t.pasos[6].inversionEstimada > 0 && t.pasos[8].roiProyectado < 0)) return false;
    if (f.soloListas && !(t.estado === 'aprobada' && tacticaCompleta(t))) return false;
    return true;
  });
}

export const activeFilterCount = (f: Filters) =>
  f.estados.length + (f.canal ? 1 : 0) + (f.riesgo ? 1 : 0) + (f.soloRoiNegativo ? 1 : 0) + (f.soloListas ? 1 : 0);
