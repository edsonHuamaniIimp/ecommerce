import type { GessStandDTO } from "@/types/dto/models";

export interface GessStandDomain {
  id: string;
  standApiId: string;
  standCode: string;
  tipoStand: string | null;
  medidas: string | null;
  estado: string | null;
  empresa: string | null;
  pabellon: string | null;
  bloqueId: string | null;
}

export function mapGessStandFromDTO(dto: GessStandDTO): GessStandDomain {
  return {
    id: dto.id,
    standApiId: dto.stand_api_id,
    standCode: dto.stand_code,
    tipoStand: dto.tipo_stand,
    medidas: dto.medidas,
    estado: dto.estado,
    empresa: dto.empresa,
    bloqueId: dto.bloque_id,
    pabellon: dto.pabellon,
  };
}
