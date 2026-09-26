import 'client-only';

import { internalApi } from "./internal-api";
import type { EventoPadrePresalaDTO, CreateEventoRequestDTO, UpdateEventoRequestDTO } from "@/types/dto/eventos";
import type { ModalInfoConfig } from "@/domain/models/entities";

export const eventosServiceClient = {
  listar() {
    return internalApi.get<Record<string, unknown>[]>("/api/eventos/listar");
  },
  modalInfo(tipoEvento: number, codigoEvento: number) {
    return internalApi.get<ModalInfoConfig | null>(`/api/eventos/modal-info?tipoEvento=${tipoEvento}&codigoEvento=${codigoEvento}`);
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
