import type { GessStandEntity } from "../models/entities";

export interface IGessRepository {
  findByEvento(eventoId: string): Promise<GessStandEntity[]>;
  findByBloque(bloqueId: string): Promise<GessStandEntity | null>;
  upsert(eventoId: string, standApiId: string, data: Partial<GessStandEntity>): Promise<GessStandEntity>;
  vincular(id: string, bloqueId: string | null): Promise<GessStandEntity>;
}
