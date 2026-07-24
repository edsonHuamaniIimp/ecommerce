import { internalApi } from "./internal-api";
import type { GessStandDTO, GessSyncResultDTO } from "@/types/dto/models";

export const gessService = {
  list(eventoId: string) {
    return internalApi.get<GessStandDTO[]>(`/api/gess?eventoId=${encodeURIComponent(eventoId)}`);
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
};
