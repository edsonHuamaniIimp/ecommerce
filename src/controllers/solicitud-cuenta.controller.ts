import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { crearSolicitudCuentaSchema, revisarSolicitudCuentaSchema } from "@/validators/solicitud-cuenta.validator";
import type { CrearSolicitudCuentaResult } from "@/types/dto/solicitud-cuenta/crear-solicitud-cuenta-result.dto";
import type { ListarSolicitudesCuentaResult } from "@/types/dto/solicitud-cuenta/listar-solicitudes-cuenta-result.dto";
import type { RevisarSolicitudCuentaResult } from "@/types/dto/solicitud-cuenta/revisar-solicitud-cuenta-result.dto";

export const solicitudCuentaController = {
  /**
   * Registra una solicitud de cuenta de nuevo exhibidor desde el portal publico.
   * @request CrearSolicitudCuentaRequestDTO
   */
  async crear(request: Request): Promise<NextResponse> {
    const parsed = crearSolicitudCuentaSchema.safeParse(await request.json());
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join("; ");
      return error(API_ERROR_CODES.VALIDATION, message, 400);
    }

    const result: CrearSolicitudCuentaResult = await services.solicitudCuenta.crear(parsed.data);
    if (!result.ok) return error(API_ERROR_CODES.CONFLICT, result.message, 409);
    return success(result);
  },

  /**
   * Lista las solicitudes de cuenta para su revision (requiere permiso roles:manage).
   * @request estado opcional por query string (?estado=pendiente)
   */
  async listar(request: Request): Promise<NextResponse> {
    const estado = new URL(request.url).searchParams.get("estado") ?? undefined;
    const result: ListarSolicitudesCuentaResult = await services.solicitudCuenta.listar(estado);
    return success(result);
  },

  /**
   * Aprueba o rechaza una solicitud de cuenta (requiere permiso roles:manage).
   * @request RevisarSolicitudCuentaRequestDTO
   */
  async revisar(request: Request): Promise<NextResponse> {
    const parsed = revisarSolicitudCuentaSchema.safeParse(await request.json());
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join("; ");
      return error(API_ERROR_CODES.VALIDATION, message, 400);
    }

    const result: RevisarSolicitudCuentaResult = await services.solicitudCuenta.revisar(parsed.data);
    if (!result.ok) {
      const code = result.message === "No autenticado" ? API_ERROR_CODES.UNAUTHORIZED : API_ERROR_CODES.CONFLICT;
      return error(code, result.message, code === API_ERROR_CODES.UNAUTHORIZED ? 401 : 409);
    }
    return success(result);
  },
};
