import { NextResponse } from "next/server";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import { validarIntegracionM2M } from "@/lib/server/integracion-m2m";
import { SolicitudesPrismaRepository } from "@/infrastructure/persistence/solicitudes-repository";
import { facturacionRepo } from "@/infrastructure/persistence/facturacion-repository";
import { NotificacionFacturaApplicationService } from "@/application/facturacion-iimp/notificacion-factura-service";

const service = new NotificacionFacturaApplicationService(new SolicitudesPrismaRepository(), facturacionRepo);

/**
 * API entrante (M2M) del sistema de facturacion: registra contra una cuota de la
 * reserva IIMP el nombre del documento (factura/boleta) y el estado de pago.
 * Autenticacion por `x-api-key` (INTEGRACION_API_KEY); en local no se exige clave.
 */
export const integracionFacturaController = {
  async registrar(request: Request): Promise<NextResponse> {
    if (!validarIntegracionM2M(request)) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    let raw: Record<string, unknown> | null = null;
    try {
      raw = (await request.json()) as Record<string, unknown>;
    } catch {
      raw = null;
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return error(API_ERROR_CODES.VALIDATION, "JSON invalido", 400);
    }

    try {
      const resultado = await service.registrar({
        numeroSolicitud: typeof raw.numeroSolicitud === "string" ? raw.numeroSolicitud : null,
        contrato: typeof raw.contrato === "string" ? raw.contrato : null,
        cuota: Number(raw.cuota),
        documento: typeof raw.documento === "string" ? raw.documento : "",
        estadoPago: Number(raw.estadoPago),
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
