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

export interface IGessRepository {
  findAllPaginated(eventoId: string, params: GessPaginationParams): Promise<GessPaginatedResult>;
  findByBloque(bloqueId: string): Promise<GessStandEntity | null>;
  findByStandApiId(eventoId: string, standApiId: string): Promise<GessStandEntity | null>;
  findById(id: string): Promise<GessStandEntity | null>;
  findByEvento(eventoId: string): Promise<GessStandEntity[]>;
  create(data: Partial<GessStandEntity>): Promise<GessStandEntity>;
  update(id: string, data: Partial<GessStandEntity>): Promise<GessStandEntity>;
  countByEvento(eventoId: string): Promise<number>;
}
