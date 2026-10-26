import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { useAppStore } from '../store/useAppStore';
import { avatarFormSchema, productoFormSchema, type AvatarForm, type ProductoForm } from '../lib/schema';

export function AvatarFormModal({ id, onClose }: { id?: string; onClose: () => void }) {
  const existing = useAppStore((s) => (id ? s.data.avatares.find((a) => a.id === id) : undefined));
  const { addAvatar, updateAvatar, removeAvatar, confirm, toast } = useAppStore.getState();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AvatarForm>({
    resolver: zodResolver(avatarFormSchema),
    defaultValues: existing ? { nombre: existing.nombre, tamañoSegmento: existing.tamañoSegmento } : { nombre: '', tamañoSegmento: 1000 },
  });

  const onSubmit = (v: AvatarForm) => {
    if (existing) {
      updateAvatar(existing.id, v);
      toast(`Avatar «${v.nombre}» actualizado`, 'success');
    } else if (addAvatar(v)) toast(`Avatar «${v.nombre}» creado`, 'success');
    onClose();
  };

  return (
    <Modal
      title={existing ? 'Editar avatar' : 'Nuevo avatar'}
      onClose={onClose}
      size="sm"
      footer={
        <>
          {existing && (
            <button
              type="button"
              className="btn btn-ghost mr-auto"
              onClick={() =>
                confirm({
                  title: 'Eliminar avatar',
                  message: `Se eliminará «${existing.nombre}» y todas sus celdas. Puedes deshacerlo con Ctrl/Cmd+Z.`,
                  onConfirm: () => {
                    removeAvatar(existing.id);
                    toast('Avatar eliminado', 'success');
                  },
                })
              }
            >
              <Trash2 size={16} aria-hidden /> Eliminar
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="avatar-form" className="btn btn-primary">
            {existing ? 'Guardar' : 'Crear avatar'}
          </button>
        </>
      }
    >
      <form id="avatar-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="av-nombre" className="label">
            Nombre del avatar
          </label>
          <input
            id="av-nombre"
            className="field"
            autoComplete="off"
            placeholder="Ej. Dueño de pyme local"
            aria-invalid={!!errors.nombre}
            aria-describedby={errors.nombre ? 'av-nombre-err' : undefined}
            {...register('nombre')}
          />
          {errors.nombre && (
            <p id="av-nombre-err" className="error-text">
              {errors.nombre.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="av-seg" className="label">
            Tamaño del segmento (personas)
          </label>
          <input
            id="av-seg"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            className="field"
            aria-invalid={!!errors.tamañoSegmento}
            aria-describedby="av-seg-help"
            {...register('tamañoSegmento', { valueAsNumber: true })}
          />
          <p id="av-seg-help" className="mt-1 text-xs">
            {errors.tamañoSegmento ? <span className="error-text">{errors.tamañoSegmento.message}</span> : 'Se usa para calcular el potencial: segmento × precio.'}
          </p>
        </div>
      </form>
    </Modal>
  );
}

export function ProductoFormModal({ id, onClose }: { id?: string; onClose: () => void }) {
  const existing = useAppStore((s) => (id ? s.data.productos.find((p) => p.id === id) : undefined));
  const moneda = useAppStore((s) => s.moneda);
  const { addProducto, updateProducto, removeProducto, confirm, toast } = useAppStore.getState();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductoForm>({
    resolver: zodResolver(productoFormSchema),
    defaultValues: existing ? { nombre: existing.nombre, precio: existing.precio } : { nombre: '', precio: 100 },
  });

  const onSubmit = (v: ProductoForm) => {
    if (existing) {
      updateProducto(existing.id, v);
      toast(`Producto «${v.nombre}» actualizado`, 'success');
    } else if (addProducto(v)) toast(`Producto «${v.nombre}» creado`, 'success');
    onClose();
  };

  return (
    <Modal
      title={existing ? 'Editar producto' : 'Nuevo producto'}
      onClose={onClose}
      size="sm"
      footer={
        <>
          {existing && (
            <button
              type="button"
              className="btn btn-ghost mr-auto"
              onClick={() =>
                confirm({
                  title: 'Eliminar producto',
                  message: `Se eliminará «${existing.nombre}» y todas sus celdas. Puedes deshacerlo con Ctrl/Cmd+Z.`,
                  onConfirm: () => {
                    removeProducto(existing.id);
                    toast('Producto eliminado', 'success');
                  },
                })
              }
            >
              <Trash2 size={16} aria-hidden /> Eliminar
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="producto-form" className="btn btn-primary">
            {existing ? 'Guardar' : 'Crear producto'}
          </button>
        </>
      }
    >
      <form id="producto-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="pr-nombre" className="label">
            Nombre del producto
          </label>
          <input
            id="pr-nombre"
            className="field"
            autoComplete="off"
            placeholder="Ej. Mentoría 1:1"
            aria-invalid={!!errors.nombre}
            aria-describedby={errors.nombre ? 'pr-nombre-err' : undefined}
            {...register('nombre')}
          />
          {errors.nombre && (
            <p id="pr-nombre-err" className="error-text">
              {errors.nombre.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="pr-precio" className="label">
            Precio ({moneda})
          </label>
          <input
            id="pr-precio"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className="field"
            aria-invalid={!!errors.precio}
            aria-describedby={errors.precio ? 'pr-precio-err' : undefined}
            {...register('precio', { valueAsNumber: true })}
          />
          {errors.precio && (
            <p id="pr-precio-err" className="error-text">
              {errors.precio.message}
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
