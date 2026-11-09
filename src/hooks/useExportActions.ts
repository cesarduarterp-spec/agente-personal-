import { useMemo } from 'react';
import { useTacticaStore } from '../store/useTacticaStore';
import { useUiStore } from '../store/useUiStore';
import { exportCSV, exportJSONFile, exportPDF, exportPNG } from '../lib/exporters';
import { buildShareUrl } from '../lib/persistence';
import { cloudEnabled, createShortLink, currentUserEmail } from '../lib/supabase';
import { publicBase } from '../lib/persistence';

const MAX_URL = 8000;

export function useExportActions() {
  return useMemo(() => {
    const ts = () => useTacticaStore.getState().tacticas;
    const toast = (m: string, tone?: 'info' | 'error') => useUiStore.getState().toast(m, tone);
    const guard = (fn: () => Promise<void> | void, ok: string) => async () => {
      if (ts().length === 0) return toast('No hay tácticas que exportar', 'error');
      try {
        await fn();
        toast(ok);
      } catch (e) {
        toast(`Error al exportar: ${(e as Error).message}`, 'error');
      }
    };
    const copy = async (text: string) => {
      try { await navigator.clipboard.writeText(text); return true; } catch { window.prompt('Copia el enlace:', text); return false; }
    };
    return {
      png: guard(exportPNG, 'PNG exportado (2x)'),
      pdf: guard(() => exportPDF(ts()), 'PDF ejecutivo generado'),
      csv: guard(() => exportCSV(ts()), 'CSV exportado'),
      json: guard(() => exportJSONFile(useTacticaStore.getState().exportJSON()), 'JSON exportado'),
      share: guard(async () => {
        const url = buildShareUrl(ts());
        // Enlaces enormes: si hay Supabase y sesión, crear enlace corto
        if (url.length > MAX_URL && cloudEnabled && (await currentUserEmail())) {
          const id = await createShortLink(ts());
          await copy(`${publicBase()}?id=${id}`);
          return;
        }
        if (url.length > MAX_URL) toast('El enlace es muy largo; algunos servicios podrían cortarlo. Usa enlace corto (Ajustes) o JSON.', 'error');
        await copy(url);
      }, 'Enlace compartido copiado'),
      shortLink: guard(async () => {
        const id = await createShortLink(ts());
        await copy(`${publicBase()}?id=${id}`);
      }, 'Enlace corto copiado'),
    };
  }, []);
}
