import { NextResponse } from "next/server";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import { validarIntegracionM2M } from "@/lib/server/integracion-m2m";
import { services } from "@/lib/server/services";

/**
 * API entrante (M2M) de solo lectura: el SIE consulta los datos VIGENTES de una solicitud
 * (cliente facturado, montos, stands y cuotas) para actualizar su registro sin que la
 * plataforma regenere ni reenvie la reserva. Autenticacion por `x-api-key` (INTEGRACION_API_KEY).
 */
export const integracionSolicitudController = {
  async consultar(request: Request): Promise<NextResponse> {
    if (!validarIntegracionM2M(request)) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const params = new URL(request.url).searchParams;
    try {
      const resultado = await services.solicitarFactura.consultarVigente({
        numeroSolicitud: params.get("numeroSolicitud"),
        contrato: params.get("contrato"),
      });
      return success(resultado);
    } catch (err) {
      if (err instanceof DomainError) {
        return NextResponse.json({ success: false, error: { code: err.code, message: err.message } }, { status: err.status });
      }
      throw err;
    }
  },
};
