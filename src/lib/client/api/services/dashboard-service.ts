import 'client-only';

import type { EstadisticasEventoDTO } from "@/types/dto/dashboard/estadisticas-evento.dto";
import { internalApi } from "./internal-api";

export const dashboardService = {
  estadisticas() {
    return internalApi.get<EstadisticasEventoDTO>("/api/dashboard/estadisticas");
  },
};
