import { internalApi } from "./internal-api";
import type { EventoPadrePresalaDTO, CreateEventoRequestDTO, UpdateEventoRequestDTO } from "@/types/dto/eventos";

export const eventosServiceClient = {
  listar() {
    return internalApi.get<Record<string, unknown>[]>("/api/eventos/listar");
  },
  listarPresala() {
    return internalApi.get<EventoPadrePresalaDTO[]>("/api/eventos/listar?presala=1");
  },
  crear(body: CreateEventoRequestDTO) {
    return internalApi.post<Record<string, unknown>>("/api/eventos/crear", body);
  },
  actualizar(body: UpdateEventoRequestDTO) {
    return internalApi.patch<Record<string, unknown>>("/api/eventos/actualizar", body);
  },
};
