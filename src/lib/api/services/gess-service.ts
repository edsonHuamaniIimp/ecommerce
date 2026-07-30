import { internalApi } from "./internal-api";
import type { GessStandDTO, GessSyncResultDTO } from "@/types/dto/models";
import type { PaginatedResponseDTO } from "@/types/dto/pagination.dto";

export const gessService = {
  /** Paginado (para bandejas) */
  list(eventoId: string, params?: { page?: number; per_page?: number; search?: string }) {
    const qs = new URLSearchParams({ eventoId });
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    if (params?.search) qs.set("search", params.search);
    return internalApi.get<PaginatedResponseDTO<GessStandDTO>>(`/api/gess?${qs.toString()}`);
  },
  /** Todos los registros (plano, vinculacion) */
  async all(eventoId: string) {
    const res = await internalApi.get<PaginatedResponseDTO<GessStandDTO>>(`/api/gess?eventoId=${encodeURIComponent(eventoId)}&per_page=1000`);
    return res.data;
  },
  listAll(eventoId: string): Promise<GessStandDTO[]> {
    return this.list(eventoId, { per_page: 1000 }).then((r) => r.data);
  },
  findByBloque(bloqueId: string) {
    return internalApi.get<GessStandDTO | null>(`/api/gess?bloqueId=${encodeURIComponent(bloqueId)}`);
  },
  vincular(id: string, bloqueId: string | null) {
    return internalApi.patch<GessStandDTO>("/api/gess", { id, bloqueId });
  },
  sync(body: { eventoId: string; tipoEvento: number; codigoEvento: number; seleccionadas?: Record<string, unknown>[] }) {
    return internalApi.post<GessSyncResultDTO>("/api/gess/sync", body);
  },
  fetchFromApi(tipoEvento: number, codigoEvento: number) {
    return internalApi.post<Record<string, unknown>[]>("/api/planogess", { tipoEvento, codigoEvento });
  },
};
