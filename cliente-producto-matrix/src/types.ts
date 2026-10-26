export interface Avatar {
  id: string;
  nombre: string;
  tamañoSegmento: number;
}

export interface Producto {
  id: string;
  nombre: string;
  precio: number;
}

export interface Celda {
  avatarId: string;
  productoId: string;
  compra: boolean;
  unidades: number;
  npsDelMatch?: number;
  notas?: string;
}

export interface State {
  avatares: Avatar[];
  productos: Producto[];
  celdas: Celda[];
}

/** Envoltorio versionado para localStorage, export JSON y enlaces compartidos. */
export interface Envelope {
  v: 1;
  updatedAt: string;
  data: State;
}

export type View = 'matriz' | 'oportunidades';

export type Moneda = 'EUR' | 'USD' | 'MXN' | 'COP' | 'ARS' | 'CLP' | 'PEN';

export interface Filtros {
  query: string;
  soloMono: boolean;
  soloHuerfanos: boolean;
  npsMin: number | null;
}
