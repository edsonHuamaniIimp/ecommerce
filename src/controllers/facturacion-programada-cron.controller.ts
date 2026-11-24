import { NextResponse } from "next/server";
import { after } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES, CRON_SECRET_HEADER } from "@/lib/shared/constants";
import { getCronSecret } from "@/lib/server/sgc-config";
import { comparacionTiempoConstante } from "@/lib/shared/utils/sgc";

/** Evita corridas solapadas dentro de la misma instancia (entre instancias manda el candado de la BD). */
let enEjecucion = false;

/**
 * Cron de EventBridge Scheduler (cada minuto): registra las solicitudes de factura
 * programadas cuya fecha ya llego. Responde 202 enseguida (la API destination de
 * EventBridge corta a los 5 s) y procesa despues de responder.
 */
export const facturacionProgramadaCronController = {
  async ejecutar(request: Request): Promise<NextResponse> {
    const secret = getCronSecret();
    const enviado = request.headers.get(CRON_SECRET_HEADER) ?? "";
    if (!secret || !enviado || !comparacionTiempoConstante(secret, enviado)) {
      return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    }
    if (enEjecucion) return success({ aceptado: true, omitido: "corrida en curso" }, { status: 202 });
    enEjecucion = true;
    after(async () => {
      try {
        const r = await services.facturacionProgramada.ejecutarVencidas();
        if (r.procesadas > 0) console.info("[facturacion-programada]", JSON.stringify(r));
      } catch (e) {
        console.error("[facturacion-programada] error", e instanceof Error ? e.message : e);
      } finally {
        enEjecucion = false;
      }
    });
    return success({ aceptado: true }, { status: 202 });
  },
};
