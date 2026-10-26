import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useIsMobile } from '../hooks/useMediaQuery';
import { celdaFormSchema, type CeldaForm } from '../lib/schema';
import { cellKey } from '../lib/metrics';
import { fmtMoney } from '../lib/format';

export function CellPopover() {
  const target = useAppStore((s) => s.selectedCell);
  if (!target) return null;
  return <CellPopoverInner key={cellKey(target.avatarId, target.productoId)} avatarId={target.avatarId} productoId={target.productoId} />;
}

function CellPopoverInner({ avatarId, productoId }: { avatarId: string; productoId: string }) {
  const avatar = useAppStore((s) => s.data.avatares.find((a) => a.id === avatarId));
  const producto = useAppStore((s) => s.data.productos.find((p) => p.id === productoId));
  const celda = useAppStore((s) => s.data.celdas.find((c) => c.avatarId === avatarId && c.productoId === productoId));
  const readOnly = useAppStore((s) => s.readOnly);
  const moneda = useAppStore((s) => s.moneda);
  const { selectCell, upsertCelda, clearCelda, toast } = useAppStore.getState();
  const isMobile = useIsMobile();
  const ref = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const close = () => selectCell(null);
  useFocusTrap(ref, true, close, firstRef);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<CeldaForm>({
    resolver: zodResolver(celdaFormSchema),
    defaultValues: {
      compra: celda?.compra ?? true,
      unidades: celda?.unidades ?? (celda ? 0 : 1),
      npsDelMatch: celda?.npsDelMatch ?? null,
      notas: celda?.notas ?? '',
    },
  });

  useLayoutEffect(() => {
    if (isMobile) return;
    const anchor = document.querySelector<HTMLElement>(`[data-cell="${CSS.escape(cellKey(avatarId, productoId))}"]`);
    const pop = ref.current;
    if (!anchor || !pop) {
      setPos({ top: 80, left: 16 });
      return;
    }
    const r = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    let left = r.left + r.width / 2 - pw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    let top = r.bottom + 8;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 8);
    setPos({ top, left });
  }, [avatarId, productoId, isMobile]);

  if (!avatar || !producto) return null;

  const unidadesReg = register('unidades', { valueAsNumber: true });
  const unidades = watch('unidades');
  const compra = watch('compra');
  const ingreso = compra && Number.isFinite(unidades) ? unidades * producto.precio : 0;

  const onSubmit = (v: CeldaForm) => {
    upsertCelda({
      avatarId,
      productoId,
      compra: v.compra,
      unidades: v.unidades,
      ...(v.npsDelMatch !== null ? { npsDelMatch: v.npsDelMatch } : {}),
      ...(v.notas.trim() ? { notas: v.notas.trim() } : {}),
    });
    toast('Celda actualizada', 'success');
    close();
  };

  const style = isMobile ? undefined : pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 };

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/30 md:bg-transparent" aria-hidden="true" onClick={close} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cell-pop-title"
        className={
          isMobile
            ? 'fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto border-t-2 border-black bg-white'
            : 'fixed z-50 w-[320px] border-2 border-black bg-white shadow-brutal'
        }
        style={style}
      >
        <div className="flex items-start justify-between gap-2 border-b-2 border-black bg-yellow px-3 py-2">
          <div>
            <p className="text-[11px] font-bold uppercase">Match</p>
            <h2 id="cell-pop-title" className="text-base leading-tight">
              {avatar.nombre} × {producto.nombre}
            </h2>
          </div>
          <button type="button" className="btn btn-icon btn-ghost min-h-[32px] -mr-1" onClick={close} aria-label="Cerrar">
            <X size={16} aria-hidden />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3 p-3">
          <fieldset disabled={readOnly} className="space-y-3">
            <Controller
              control={control}
              name="compra"
              render={({ field }) => (
                <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-black"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    onBlur={field.onBlur}
                  />
                  Este avatar compra el producto
                </label>
              )}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="cell-unidades" className="label">
                  Unidades
                </label>
                <input
                  id="cell-unidades"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  className="field"
                  aria-invalid={!!errors.unidades}
                  aria-describedby={errors.unidades ? 'cell-unidades-err' : undefined}
                  {...unidadesReg}
                  ref={(el) => {
                    unidadesReg.ref(el);
                    firstRef.current = el;
                  }}
                />
                {errors.unidades && (
                  <p id="cell-unidades-err" className="error-text">
                    {errors.unidades.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="cell-nps" className="label">
                  NPS del match
                </label>
                <Controller
                  control={control}
                  name="npsDelMatch"
                  render={({ field }) => (
                    <select
                      id="cell-nps"
                      className="field"
                      value={field.value === null ? '' : String(field.value)}
                      onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                      onBlur={field.onBlur}
                    >
                      <option value="">Sin dato</option>
                      {Array.from({ length: 11 }, (_, i) => 10 - i).map((n) => (
                        <option key={n} value={n}>
                          {n} {n >= 9 ? '· promotor' : n <= 6 ? '· detractor' : '· pasivo'}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </div>
            </div>
            <div>
              <label htmlFor="cell-notas" className="label">
                Notas
              </label>
              <textarea id="cell-notas" rows={3} className="field resize-y" aria-invalid={!!errors.notas} {...register('notas')} />
              {errors.notas && <p className="error-text">{errors.notas.message}</p>}
            </div>
          </fieldset>
          <p className="border-2 border-black px-2 py-1 text-sm">
            Ingreso del match: <strong>{fmtMoney(ingreso, moneda)}</strong>
            <span className="block text-xs">
              {Number.isFinite(unidades) ? unidades : 0} u × {fmtMoney(producto.precio, moneda)}
            </span>
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {celda && !readOnly && (
              <button
                type="button"
                className="btn btn-ghost mr-auto"
                onClick={() => {
                  clearCelda(avatarId, productoId);
                  toast('Celda vaciada', 'success');
                  close();
                }}
              >
                Vaciar celda
              </button>
            )}
            <button type="button" className="btn" onClick={close}>
              {readOnly ? 'Cerrar' : 'Cancelar'}
            </button>
            {!readOnly && (
              <button type="submit" className="btn btn-primary">
                Guardar
              </button>
            )}
          </div>
        </form>
      </div>
    </>,
    document.body,
  );
}
