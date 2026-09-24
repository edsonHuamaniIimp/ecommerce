import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success } from "@/lib/server/api-response";
import { getSession } from "@/lib/server/auth";
import type { EstadisticasEventoDTO } from "@/types/dto/dashboard/estadisticas-evento.dto";

export const dashboardController = {
  /** Ocupacion y recaudacion del evento de la sesion. Sin evento, devuelve ceros. */
  async estadisticas(): Promise<NextResponse> {
    const session = await getSession();
    const result: EstadisticasEventoDTO = await services.dashboard.estadisticasEvento(session?.eventoId ?? "");
    return success(result);
  },
};
