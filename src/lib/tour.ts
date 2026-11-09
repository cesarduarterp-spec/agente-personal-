import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export const TOUR_KEY = 'vn-tactica-aterrizada-tour';

export function tourSeen(): boolean {
  try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return true; }
}

export function startTour() {
  const d = driver({
    popoverClass: 'vn-tour',
    showProgress: true,
    nextBtnText: 'Siguiente',
    prevBtnText: 'Anterior',
    doneBtnText: 'Empezar',
    progressText: '{{current}} de {{total}}',
    onDestroyed: () => { try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* noop */ } },
    steps: [
      { element: '#btn-new', popover: { title: '1. Crea una táctica', description: 'Un wizard de 8 pasos te obliga a aterrizarla: evidencia, plan, responsable, herramientas, riesgo, inversión, KPI y retorno. No avanzas sin datos mínimos.' } },
      { element: '#main-view', popover: { title: '2. Muévela por su ciclo', description: 'Borrador → Aprobada → Ejecutando → Medida. Arrastra con el ratón o con teclado (Espacio, flechas, Enter). En Portafolio comparas ROI y riesgo.' } },
      { element: '#btn-diag', popover: { title: '3. Lee el diagnóstico', description: 'Hallazgos automáticos: ROI negativo, riesgos repetidos, concentración de inversión y tácticas listas para esta semana. Exporta PDF, PNG, CSV o comparte un enlace. Cmd/Ctrl+K para todo.' } },
    ],
  });
  d.drive();
}
