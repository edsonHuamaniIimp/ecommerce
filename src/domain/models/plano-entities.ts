/* ================================================================
   ENTIDADES DE DOMINIO — Laboratorio 3D (Planos)
   ================================================================ */

export interface PlanoTipoBloqueEntity {
  id: string;
  planoId: string;
  codigo: string;
  label: string;
  nombre: string;
  w: number;
  d: number;
  h: number;
  color: string;
}

export interface PlanoBloqueEntity {
  id: string;
  planoId: string;
  tipoId: string | null;
  bloqueId: string;
  tipoCodigo: string;
  tipologia: string | null;
  x: number;
  z: number;
  rotY: number;
  orden: number;
  flgActivo: boolean;
}

export interface PlanoFurnitureEntity {
  id: string;
  planoId: string;
  refId: string;
  tipo: string;
  x: number;
  z: number;
  rotY: number;
  config: unknown;
}

export interface PlanoSeccionEntity {
  id: string;
  planoId: string;
  codigo: string;
  nombre: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotacion: number;
  color: string;
  planoHijoId: string | null;
  orden: number;
}

export interface PlanoEntity {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  imagenFondo: string | null;
  config: unknown;
  flgActivo: boolean;
  tipos: PlanoTipoBloqueEntity[];
  bloques: PlanoBloqueEntity[];
  furniture: PlanoFurnitureEntity[];
  secciones: PlanoSeccionEntity[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SeccionOcupacion {
  seccionCodigo: string;
  total: number;
  disponibles: number;
  pctDisponible: number;
}

export interface PlanoListItem {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  bloquesCount: number;
  tiposCount: number;
  flgActivo: boolean;
  /** Evento que tiene asignado este plano (regla: un mapa en un solo evento). null = libre */
  eventoAsignado: { tipoEvento: number; codigoEvento: number } | null;
  updatedAt: Date;
}

export interface PlanoExportJSON {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo?: string;
  imagenFondo?: string | null;
  tipos: Array<{ codigo: string; label: string; nombre: string; w: number; d: number; h: number; color: string }>;
  bloques: Array<{ bloqueId: string; tipoCodigo: string; tipologia?: string | null; x: number; z: number; rotY: number; orden: number }>;
  furniture: Array<{ refId: string; tipo: string; x: number; z: number; rotY: number; config?: unknown }>;
  secciones?: Array<{ codigo: string; nombre: string; x: number; y: number; w: number; h: number; rotacion: number; color: string; planoHijoId: string | null; planoHijoCodigo?: string | null; orden: number }>;
}
