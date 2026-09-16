export interface PlanoTipoDTO {
  id: string;
  codigo: string;
  label: string;
  nombre: string;
  w: number;
  d: number;
  h: number;
  color: string;
}

export interface PlanoBloqueDTO {
  id: string;
  bloqueId: string;
  tipoCodigo: string;
  tipologia: string | null;
  x: number;
  z: number;
  rotY: number;
  orden: number;
  flgActivo: boolean;
}

export interface PlanoFurnitureDTO {
  id: string;
  refId: string;
  tipo: string;
  x: number;
  z: number;
  rotY: number;
  config: unknown;
}

export interface PlanoSeccionDTO {
  id: string;
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

export interface SeccionOcupacionDTO {
  seccionCodigo: string;
  total: number;
  disponibles: number;
  pctDisponible: number;
}

export interface PlanoDTO {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  imagenFondo: string | null;
  flgActivo: boolean;
  tipos: PlanoTipoDTO[];
  bloques: PlanoBloqueDTO[];
  furniture: PlanoFurnitureDTO[];
  secciones: PlanoSeccionDTO[];
  updatedAt: string;
}

export interface PlanoListItemDTO {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  bloquesCount: number;
  tiposCount: number;
  flgActivo: boolean;
  /** null = plano libre; si tiene valor, el plano ya esta asignado a ese evento */
  eventoAsignado: { tipoEvento: number; codigoEvento: number } | null;
  updatedAt: string;
}

export interface PlanoExportDTO {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipos: Array<{ codigo: string; label: string; nombre: string; w: number; d: number; h: number; color: string }>;
  bloques: Array<{ bloqueId: string; tipoCodigo: string; x: number; z: number; rotY: number; orden: number }>;
  furniture: Array<{ refId: string; tipo: string; x: number; z: number; rotY: number; config?: unknown }>;
}

export interface PlanoTsExportDTO {
  bloques: string;
  tipos: string;
  construccion: string;
  index: string;
  registrySnippet: string;
}

export interface PlanoPublicoSeccionDTO {
  codigo: string;
  nombre: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotacion?: number;
  color: string;
  planoHijoId: string | null;
  planoHijoCodigo?: string | null;
}

export interface PlanoPublicoOcupacionDTO {
  seccionCodigo: string;
  total: number;
  disponibles: number;
  pctDisponible: number;
}

export interface PlanoPublicoPayloadDTO {
  codigo: string;
  nombre: string;
  tipo: string;
  imagenFondo: string | null;
  tipos: PlanoTipoDTO[];
  bloques: PlanoBloqueDTO[];
  furniture: PlanoFurnitureDTO[];
  secciones: PlanoPublicoSeccionDTO[];
  ocupacion: PlanoPublicoOcupacionDTO[] | null;
}
