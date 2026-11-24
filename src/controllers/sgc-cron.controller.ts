import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES, CRON_SECRET_HEADER } from "@/lib/shared/constants";
import { getCronSecret } from "@/lib/server/sgc-config";
import { comparacionTiempoConstante } from "@/lib/shared/utils/sgc";

/**
 * Endpoint para el scheduler (cron). No usa sesion: se autentica con el header
 * `x-cron-secret` comparado en tiempo constante contra `CRON_SECRET`.
 */
export const sgcCronController = {
  async reconciliar(request: Request): Promise<NextResponse> {
    const secret = getCronSecret();
    const enviado = request.headers.get(CRON_SECRET_HEADER) ?? "";
    if (!secret || !enviado || !comparacionTiempoConstante(secret, enviado)) {
      return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    }

    const reconciliacion = await services.sgc.sincronizarCron();
    const outbox = await services.sgcOutbox.despachar();
    return success({ ...reconciliacion, outbox });
  },
};
