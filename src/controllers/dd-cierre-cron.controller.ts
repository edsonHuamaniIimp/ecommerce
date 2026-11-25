import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES, CRON_SECRET_HEADER } from "@/lib/shared/constants";
import { getCronSecret } from "@/lib/server/sgc-config";
import { comparacionTiempoConstante } from "@/lib/shared/utils/sgc";

/**
 * Cron diario (GitHub Actions): cierra los expedientes DD Observados cuyo plazo de
 * subsanacion vencio, segun «Cierre automático» de Configuración DD.
 * `?simular=1` solo informa cuales se cerrarian, sin cambiar nada.
 */
export const ddCierreCronController = {
  async ejecutar(request: Request): Promise<NextResponse> {
    const secret = getCronSecret();
    const enviado = request.headers.get(CRON_SECRET_HEADER) ?? "";
    if (!secret || !enviado || !comparacionTiempoConstante(secret, enviado)) {
      return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    }
    const simular = new URL(request.url).searchParams.get("simular") === "1";
    try {
      const resultado = await services.debidaDiligencia.cerrarObservadasVencidas({ simular });
      if (resultado.cerrados.length > 0 || resultado.errores > 0) {
        console.info("[dd-cierre-automatico]", JSON.stringify(resultado));
      }
      return success(resultado);
    } catch (e) {
      console.error("[dd-cierre-automatico] error", e instanceof Error ? e.message : e);
      return error(API_ERROR_CODES.INTERNAL, "No se pudo ejecutar el cierre automático", 500);
    }
  },
};
