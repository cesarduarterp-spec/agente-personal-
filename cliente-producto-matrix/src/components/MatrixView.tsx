import { Grid3x3, Plus, Sparkles, UserPlus, SearchX } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useVisible } from '../store/selectors';
import { useIsMobile } from '../hooks/useMediaQuery';
import { CAPTURE_ID } from '../lib/exporters';
import { fmtDate } from '../lib/format';
import { EmptyState } from './EmptyState';
import { Kpis } from './Kpis';
import { MatrixTable } from './MatrixTable';
import { MatrixMobile } from './MatrixMobile';

export function HeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold" aria-label="Leyenda del heatmap por ingreso">
      <span className="uppercase">Ingreso por celda:</span>
      {[
        ['bg-white', 'Sin ingreso'],
        ['bg-heat1', '≤25%'],
        ['bg-heat2', '25–50%'],
        ['bg-heat3', '50–75%'],
        ['bg-black', '>75% del máx.'],
      ].map(([c, l]) => (
        <span key={l} className="inline-flex items-center gap-1">
          <span className={`inline-block h-3 w-5 border-2 border-black ${c}`} aria-hidden />
          {l}
        </span>
      ))}
    </div>
  );
}

export function MatrixView() {
  const data = useAppStore((s) => s.data);
  const heatmap = useAppStore((s) => s.heatmap);
  const readOnly = useAppStore((s) => s.readOnly);
  const { avatares, productos } = useVisible();
  const { openModal, loadSample, resetFiltros } = useAppStore.getState();
  const isMobile = useIsMobile();

  if (!data.avatares.length && !data.productos.length) {
    return (
      <EmptyState
        icon={<Grid3x3 size={28} aria-hidden />}
        title="Tu matriz está vacía"
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={loadSample} disabled={readOnly}>
              <Sparkles size={16} aria-hidden /> Cargar datos de ejemplo
            </button>
            <button type="button" className="btn" onClick={() => openModal({ type: 'avatar' })} disabled={readOnly}>
              <UserPlus size={16} aria-hidden /> Crear primer avatar
            </button>
            <button type="button" className="btn" onClick={() => openModal({ type: 'producto' })} disabled={readOnly}>
              <Plus size={16} aria-hidden /> Crear primer producto
            </button>
          </>
        }
      >
        Cruza tus avatares (filas) con tus productos (columnas), registra unidades y NPS por match, y descubre dónde está tu próximo cross-sell.
      </EmptyState>
    );
  }
  if (!data.avatares.length || !data.productos.length) {
    const missing = !data.avatares.length ? 'avatar' : 'producto';
    return (
      <EmptyState
        icon={missing === 'avatar' ? <UserPlus size={28} aria-hidden /> : <Plus size={28} aria-hidden />}
        title={missing === 'avatar' ? 'Añade tu primer avatar' : 'Añade tu primer producto'}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => openModal({ type: missing })} disabled={readOnly}>
            <Plus size={16} aria-hidden /> Crear {missing}
          </button>
        }
      >
        {missing === 'avatar'
          ? `Ya tienes ${data.productos.length} producto(s). Necesitas al menos un avatar para formar la matriz.`
          : `Ya tienes ${data.avatares.length} avatar(es). Necesitas al menos un producto para formar la matriz.`}
      </EmptyState>
    );
  }
  if (!avatares.length || !productos.length) {
    return (
      <EmptyState
        icon={<SearchX size={28} aria-hidden />}
        title="Ningún resultado con estos filtros"
        actions={
          <button type="button" className="btn btn-primary" onClick={resetFiltros}>
            Limpiar filtros
          </button>
        }
      >
        Prueba con otra búsqueda o desactiva alguno de los filtros combinados.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <Kpis />
      {isMobile ? (
        <>
          {heatmap && <HeatLegend />}
          <MatrixMobile />
        </>
      ) : (
        <div className="matrix-scroll overflow-auto border-2 border-black" data-tour="matrix">
          <div className="inline-block min-w-full bg-white p-4">
            {heatmap && (
              <div className="mb-3">
                <HeatLegend />
              </div>
            )}
            <MatrixTable />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Copia fuera de pantalla e inerte de la matriz que usan PNG y PDF.
 * Así la exportación funciona igual desde cualquier vista o tamaño de pantalla.
 */
export function CaptureHost() {
  const active = useAppStore((s) => s.capturing);
  const heatmap = useAppStore((s) => s.heatmap);
  const hasData = useAppStore((s) => s.data.avatares.length > 0 && s.data.productos.length > 0);
  if (!active || !hasData) return null;
  return (
    <div aria-hidden="true" {...{ inert: '' }} style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }}>
      <div id={CAPTURE_ID} className="inline-block bg-white p-6" style={{ width: 'max-content' }}>
        <div className="mb-4 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase">{fmtDate(new Date())}</p>
            <h2 className="text-3xl leading-none">Cliente × Producto Matrix</h2>
          </div>
          {heatmap && <HeatLegend />}
        </div>
        <Kpis />
        <div className="mt-4">
          <MatrixTable capture />
        </div>
        <div className="h-12" />
      </div>
    </div>
  );
}
