import type { GessStandDTO, GessSyncResultDTO } from "@/types/dto/models";
import type { GessStand } from "@/types/reserva";

export function mapGessStand(dto: GessStandDTO): GessStand {
  return {
    id: dto.id,
    eventoId: dto.evento_id,
    standApiId: dto.stand_api_id,
    standCode: dto.stand_code,
    tipoStand: dto.tipo_stand,
    medidas: dto.medidas,
    estado: dto.estado,
    empresa: dto.empresa,
    pabellon: dto.pabellon,
    ubicacion: dto.ubicacion,
    rawData: dto.raw_data,
    bloqueId: dto.bloque_id,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function mapGessStandToDTO(domain: GessStand): GessStandDTO {
  return {
    id: domain.id,
    evento_id: domain.eventoId,
    stand_api_id: domain.standApiId,
    stand_code: domain.standCode,
    tipo_stand: domain.tipoStand,
    medidas: domain.medidas,
    estado: domain.estado,
    empresa: domain.empresa,
    pabellon: domain.pabellon,
    ubicacion: domain.ubicacion,
    raw_data: domain.rawData,
    bloque_id: domain.bloqueId,
    created_at: domain.createdAt,
    updated_at: domain.updatedAt,
  };
}
