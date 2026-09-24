import 'client-only';

import { internalApi } from "./internal-api";
import type { GessStandDTO, GessSyncResultDTO } from "@/types/dto/models";
import type { PaginatedResponseDTO } from "@/types/dto/pagination.dto";
import type { ReservaRequestDTO, ReservaResponseDTO } from "@/types/dto/reserva";

export const gessService = {
  /** Paginado (para bandejas) */
  list(eventoId: string, params?: { page?: number; per_page?: number; search?: string; estado?: string }) {
    const qs = new URLSearchParams({ eventoId });
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    if (params?.search) qs.set("search", params.search);
    if (params?.estado) qs.set("estado", params.estado);
    return internalApi.get<PaginatedResponseDTO<GessStandDTO>>(`/api/gess/listar?${qs.toString()}`);
  },
  /** Todos los registros (plano, vinculacion) */
  async all(eventoId: string) {
    const res = await internalApi.get<PaginatedResponseDTO<GessStandDTO>>(`/api/gess/listar?eventoId=${encodeURIComponent(eventoId)}&per_page=1000`);
    return res.data;
  },
  listAll(eventoId: string): Promise<GessStandDTO[]> {
    return this.list(eventoId, { per_page: 1000 }).then((r) => r.data);
  },
  findByBloque(bloqueId: string) {
    return internalApi.get<GessStandDTO | null>(`/api/gess/listar?bloqueId=${encodeURIComponent(bloqueId)}`);
  },
  vincular(id: string, bloqueId: string | null) {
    return internalApi.patch<GessStandDTO>("/api/gess/actualizar", { id, bloqueId });
  },
  sync(body: { eventoId: string; tipoEvento: number; codigoEvento: number; seleccionadas?: Record<string, unknown>[] }) {
    return internalApi.post<GessSyncResultDTO>("/api/gess/sync", body);
  },
  mockup(body: { eventoId: string; tipoEvento: number; codigoEvento: number }) {
    return internalApi.post<GessSyncResultDTO & { planos?: string[] }>("/api/gess/mockup", body);
  },
  fetchFromApi(tipoEvento: number, codigoEvento: number) {
    return internalApi.post<Record<string, unknown>[]>("/api/planogess/fetch", { tipoEvento, codigoEvento });
  },
  /** Enviar solicitud de reserva */
  reservar(body: ReservaRequestDTO) {
    return internalApi.post<ReservaResponseDTO>("/api/reservas/crear", body);
  },
};
