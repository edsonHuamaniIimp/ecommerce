import { internalApi } from "./internal-api";
import type { EventoPadrePresalaDTO, CreateEventoDTO } from "@/types/dto/models";

export const eventosServiceClient = {
  listPresala() {
    return internalApi.get<EventoPadrePresalaDTO[]>("/api/eventos/presala");
  },
  list() {
    return internalApi.get<Record<string, unknown>[]>("/api/eventos");
  },
  create(body: CreateEventoDTO) {
    return internalApi.post<Record<string, unknown>>("/api/eventos", body);
  },
  patch(id: string, data: Record<string, unknown>) {
    return internalApi.patch<Record<string, unknown>>("/api/eventos", { id, ...data });
  },
};
