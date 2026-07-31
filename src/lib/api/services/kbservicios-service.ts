import { internalApi } from "./internal-api";

interface EventoItemDTO {
  codeEvent: number;
  event: string;
  inicio: string;
  fin: string;
  active: boolean;
}

interface EventosResponse {
  success: boolean;
  eventslist: EventoItemDTO[];
}

interface EventTypeItem {
  code: number;
  description: string;
  codigo: string;
}

export const kbServiciosService = {
  /** Lista eventos para un tipo de evento (code = tipoEvento) */
  listarEventos(code: number) {
    return internalApi.post<EventosResponse>("/api/kbservicios/events", { code });
  },

  /** Lista tipos de evento disponibles */
  listarTiposEvento() {
    return internalApi.post<EventTypeItem[]>("/api/kbservicios/event-types");
  },
};
