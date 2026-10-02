import type { GessStandEntity } from "../models/entities";

export interface GessPaginationParams {
  page: number;
  perPage: number;
  search?: string;
  estado?: string;
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
  findByBloque(bloqueId: string): Promise<GessStandEntity | null>;
  findByStandApiId(eventoId: string, standApiId: string): Promise<GessStandEntity | null>;
  findById(id: string): Promise<GessStandEntity | null>;
  findByEvento(eventoId: string): Promise<GessStandEntity[]>;
  /** Datos de la empresa que reservo cada stand (mapa: id de gess_stand → datos). */
  datosEmpresaPorStands(standIds: string[]): Promise<Map<string, DatosReservaStand>>;
  create(data: Partial<GessStandEntity>): Promise<GessStandEntity>;
  update(id: string, data: Partial<GessStandEntity>): Promise<GessStandEntity>;
  countByEvento(eventoId: string): Promise<number>;
}
