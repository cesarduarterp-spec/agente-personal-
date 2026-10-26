import type { Celda, State } from '../types';

/**
 * Caso real tipo: escuela online de marketing digital que vende formación,
 * plantillas, membresía y servicios a cinco avatares.
 * Diseñado para disparar todos los insights (mono-producto, huérfano,
 * match perfecto, concentración, detractor).
 */
export function sampleState(): State {
  const avatares = [
    { id: 'a-emprendedora', nombre: 'Emprendedora digital', tamañoSegmento: 4200 },
    { id: 'a-pyme', nombre: 'Dueño de pyme local', tamañoSegmento: 2600 },
    { id: 'a-cmo', nombre: 'Responsable de marketing', tamañoSegmento: 1300 },
    { id: 'a-freelance', nombre: 'Freelance / agencia', tamañoSegmento: 1800 },
    { id: 'a-estudiante', nombre: 'Estudiante en reconversión', tamañoSegmento: 5200 },
  ];
  const productos = [
    { id: 'p-kit', nombre: 'Kit de plantillas', precio: 47 },
    { id: 'p-curso', nombre: 'Curso Social Media', precio: 297 },
    { id: 'p-membresia', nombre: 'Membresía anual', precio: 348 },
    { id: 'p-programa', nombre: 'Programa Estrategia Digital', precio: 1497 },
    { id: 'p-mentoria', nombre: 'Mentoría 1:1', precio: 2500 },
    { id: 'p-incompany', nombre: 'Formación in-company', precio: 6900 },
    { id: 'p-auditoria', nombre: 'Auditoría SEO express', precio: 390 },
  ];
  const c = (avatarId: string, productoId: string, unidades: number, npsDelMatch?: number, notas?: string): Celda => ({
    avatarId,
    productoId,
    compra: true,
    unidades,
    ...(npsDelMatch !== undefined ? { npsDelMatch } : {}),
    ...(notas ? { notas } : {}),
  });
  const celdas: Celda[] = [
    c('a-emprendedora', 'p-kit', 610, 8),
    c('a-emprendedora', 'p-curso', 340, 9, 'Mejor tasa de conversión desde webinar.'),
    c('a-emprendedora', 'p-programa', 128, 10, 'Testimonios en vídeo disponibles.'),
    c('a-emprendedora', 'p-membresia', 95, 7),
    c('a-pyme', 'p-curso', 150, 6, 'Piden más casos de negocio local.'),
    c('a-pyme', 'p-programa', 60, 8),
    c('a-cmo', 'p-programa', 75, 9),
    c('a-cmo', 'p-incompany', 42, 9, 'Ciclo de venta de 45 días.'),
    c('a-cmo', 'p-mentoria', 12, 10),
    c('a-freelance', 'p-kit', 280, 9),
    c('a-freelance', 'p-membresia', 140, 5, 'Churn alto a los 4 meses.'),
    c('a-freelance', 'p-mentoria', 18, 8),
    c('a-estudiante', 'p-kit', 920, 7, 'Entra por el lead magnet de Canva.'),
  ];
  return { avatares, productos, celdas };
}
