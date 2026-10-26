import { driver } from 'driver.js';
import { savePrefs } from '../lib/persistence';
import { useAppStore } from '../store/useAppStore';

/** Tour de 3 pasos. Se marca como visto al cerrarlo o completarlo. */
export function startTour(): void {
  const st = useAppStore.getState();
  st.setView('matriz');
  st.setPanelOpen(true);
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  const el = (sel: string) => document.querySelector<HTMLElement>(sel) ?? undefined;
  const d = driver({
    popoverClass: 'vn-tour',
    showProgress: true,
    progressText: 'Paso {{current}} de {{total}}',
    nextBtnText: 'Siguiente',
    prevBtnText: 'Atrás',
    doneBtnText: 'Empezar',
    overlayColor: '#000',
    overlayOpacity: 0.6,
    stagePadding: 4,
    stageRadius: 0,
    onDestroyed: () => savePrefs({ tourSeen: true }),
    steps: [
      {
        element: el('[data-tour="matrix"]') ?? el('main'),
        popover: {
          title: '1 · La matriz',
          description:
            'Filas = avatares, columnas = productos. Haz clic en una celda para registrar unidades, NPS y notas. Arrastra las asas (o Espacio + flechas) para reordenar.',
          side: 'bottom',
        },
      },
      {
        element: el('[data-tour="insights"]'),
        popover: {
          title: '2 · Diagnóstico ejecutivo',
          description: 'Hallazgos automáticos ordenados por impacto: mono-producto, huérfanos, matches perfectos y concentración de riesgo. Se recalculan en vivo.',
          side: 'left',
        },
      },
      {
        element: isMobile ? el('nav[aria-label="Acciones"]') : el('[data-tour="toolbar"]'),
        popover: {
          title: '3 · Oportunidades y exportación',
          description: `Cambia a la vista Oportunidades para ver los huecos con más potencial. Exporta PNG, PDF ejecutivo, CSV o JSON, y comparte un enlace. Pulsa ${
            /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'
          }+K para todo lo demás.`,
          side: 'top',
        },
      },
    ],
  });
  d.drive();
}
