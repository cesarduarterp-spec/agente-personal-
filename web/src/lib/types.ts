export const CATEGORIES = ['#Constructora', '#AgenciaViajes', '#ConsultoraIA', '#Estudio', '#Personal'] as const;
export type Category = (typeof CATEGORIES)[number];
export type Priority = 'alta' | 'media' | 'baja';
export type Status = 'pendiente' | 'en_progreso' | 'completada' | 'cancelada';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  category: Category;
  priority: Priority;
  status: Status;
  due_date: string | null;
  reminder_at: string | null;
  reminder_sent: boolean;
  gcal_event_id: string | null;
  completed_at: string | null;
  source: 'telegram' | 'pwa' | 'gcal' | 'system';
  last_modified_by: 'telegram' | 'pwa' | 'gcal' | 'system';
  created_at: string;
  updated_at: string;
}

/** Estilos por categoría (clases Tailwind completas para que no las purgue el compilador). */
export const CATEGORY_STYLE: Record<Category, { label: string; dot: string; pill: string; bar: string }> = {
  '#Constructora': { label: 'Constructora', dot: 'bg-orange-500', bar: 'bg-orange-500', pill: 'data-[active=true]:bg-orange-500 data-[active=true]:text-white data-[active=true]:border-orange-500' },
  '#AgenciaViajes': { label: 'Agencia Viajes', dot: 'bg-sky-500', bar: 'bg-sky-500', pill: 'data-[active=true]:bg-sky-500 data-[active=true]:text-white data-[active=true]:border-sky-500' },
  '#ConsultoraIA': { label: 'Consultora IA', dot: 'bg-violet-500', bar: 'bg-violet-500', pill: 'data-[active=true]:bg-violet-500 data-[active=true]:text-white data-[active=true]:border-violet-500' },
  '#Estudio': { label: 'Estudio', dot: 'bg-emerald-500', bar: 'bg-emerald-500', pill: 'data-[active=true]:bg-emerald-500 data-[active=true]:text-white data-[active=true]:border-emerald-500' },
  '#Personal': { label: 'Personal', dot: 'bg-rose-500', bar: 'bg-rose-500', pill: 'data-[active=true]:bg-rose-500 data-[active=true]:text-white data-[active=true]:border-rose-500' },
};

export const PRIORITY_STYLE: Record<Priority, string> = {
  alta: 'text-red-600 dark:text-red-400',
  media: 'text-amber-600 dark:text-amber-400',
  baja: 'text-stone-400',
};

export const isOpen = (t: Task) => t.status === 'pendiente' || t.status === 'en_progreso';
