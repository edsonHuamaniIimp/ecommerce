import { internalApi } from "./internal-api";
import type { EventoPadrePresalaDTO, CreateEventoRequestDTO, UpdateEventoRequestDTO } from "@/types/dto/eventos";

export const eventosServiceClient = {
  listar() {
    return internalApi.get<Record<string, unknown>[]>("/api/eventos/listar");
  },
  listarPresala() {
    return internalApi.get<EventoPadrePresalaDTO[]>("/api/eventos/presala");
  },
  crear(body: CreateEventoRequestDTO) {
    return internalApi.post<Record<string, unknown>>("/api/eventos/crear", body);
  },
  actualizar(body: UpdateEventoRequestDTO & { id: string }) {
    return internalApi.patch<Record<string, unknown>>("/api/eventos/actualizar", body);
  },
};
