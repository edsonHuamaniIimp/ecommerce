import type { GessStandDTO } from "@/types/dto/models";
import type { GessStand } from "@/types/reserva";
import { normalizarCategoriasImagen } from "@/lib/shared/constants";

export function mapGessStand(dto: GessStandDTO): GessStand {
  return {
    id: dto.id,
    eventoId: dto.eventoId,
    standApiId: dto.standApiId,
    standCode: dto.standCode,
    tipoStand: dto.tipoStand,
    medidas: dto.medidas,
    estado: dto.estado,
    empresa: dto.empresa,
    pabellon: dto.pabellon,
    ubicacion: dto.ubicacion,
    rawData: dto.rawData,
    bloqueId: dto.bloqueId,
    documentos: (Array.isArray(dto.documentos) ? dto.documentos : []) as string[],
    imagenes: (Array.isArray(dto.imagenes) ? dto.imagenes : []) as string[],
    imagenesCategorias: normalizarCategoriasImagen(dto.imagenesCategorias),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export function mapGessStandToDTO(domain: GessStand): GessStandDTO {
  return {
    id: domain.id,
    eventoId: domain.eventoId,
    standApiId: domain.standApiId,
    standCode: domain.standCode,
    tipoStand: domain.tipoStand,
    medidas: domain.medidas,
    estado: domain.estado,
    empresa: domain.empresa,
    pabellon: domain.pabellon,
    ubicacion: domain.ubicacion,
    rawData: domain.rawData,
    bloqueId: domain.bloqueId,
    documentos: domain.documentos ?? [],
    imagenes: domain.imagenes ?? [],
    imagenesCategorias: domain.imagenesCategorias ?? {},
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
  };
}
