import 'client-only';

import { internalApi } from "./internal-api";
import type { PrellenadoReservaDTO } from "@/types/dto/reserva";

/** Prellenado del wizard de reserva (solo datos del propio usuario logueado). */
export const reservaDatosService = {
  prellenar(tipoDocumento: string, numeroDocumento: string) {
    const qs = new URLSearchParams({ tipoDocumento, numeroDocumento });
    return internalApi.get<PrellenadoReservaDTO>(`/api/reserva-datos/prellenar?${qs.toString()}`);
  },
};
