import type { GessStandEntity } from "../models/entities";

export interface GessPaginationParams {
  page: number;
  perPage: number;
  search?: string;
  estado?: string;
  /** Tipo de stand exacto (gess_stand.tipo_stand). */
  tipo?: string;
  /** Bloques del plano (pabellon seleccionado) para filtrar por vinculo. */
  bloqueIds?: string[];
  /** Codigo del plano (pabellon): el servicio resuelve sus bloques en el servidor. */
  planoCodigo?: string;
  /** Solo stands sin bloque vinculado. */
  sinPabellon?: boolean;
}

export interface GessPaginatedResult {
  data: GessStandEntity[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/** Datos de la empresa que reservo un stand (para el mapa). */
export interface DatosReservaStand {
  razonSocial: string;
  /** Logo a pintar: el del usuario si tiene, si no el de la empresa. */
  logoUrl: string | null;
}

export interface IGessRepository {
  findAllPaginated(eventoId: string, params: GessPaginationParams): Promise<GessPaginatedResult>;
  /** Tipos de stand distintos del evento (para filtros). */
  tiposDistintos(eventoId: string): Promise<string[]>;
  findByBloque(bloqueId: string): Promise<GessStandEntity | null>;
  findByStandApiId(eventoId: string, standApiId: string): Promise<GessStandEntity | null>;
  findById(id: string): Promise<GessStandEntity | null>;
  findByEvento(eventoId: string): Promise<GessStandEntity[]>;
  /** Datos de la empresa que reservo cada stand (mapa: id de gess_stand → datos). */
  datosEmpresaPorStands(standIds: string[]): Promise<Map<string, DatosReservaStand>>;
  create(data: Partial<GessStandEntity>): Promise<GessStandEntity>;
  update(id: string, data: Partial<GessStandEntity>): Promise<GessStandEntity>;
  /** Bloquea temporalmente stands disponibles. Todo o nada. */
  crearHold(data: {
    standIds: string[];
    eventoId: string;
    holdId: string;
    userId: string;
    expiresAt: Date;
    /** IDs pre-reservados a nombre del usuario que crea el hold. */
    preReservadosPropios?: string[];
  }): Promise<{ ok: boolean; conflictos: string[] }>;
  /** Libera un hold propio y devuelve los stands liberados. */
  liberarHold(holdId: string, userId: string): Promise<Array<{ id: string; standCode: string; eventoId: string }>>;
  /** True si todos los stands siguen bloqueados por este hold y usuario. */
  validarHold(standIds: string[], holdId: string, userId: string): Promise<boolean>;
  countByEvento(eventoId: string): Promise<number>;
}
