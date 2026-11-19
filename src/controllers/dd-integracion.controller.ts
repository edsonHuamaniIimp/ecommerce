import { NextResponse } from "next/server";
import { error, success } from "@/lib/server/api-response";
import { validarIntegracionM2M } from "@/lib/server/integracion-m2m";
import { DomainError } from "@/lib/server/router";
import { services } from "@/lib/server/services";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { mapDdIntegracionDocumentosToDTO } from "@/lib/shared/mappers/dd-integracion";
import { ddIntegracionDocumentosQuerySchema } from "@/validators/dd-integracion.validator";

/**
 * API externa M2M: empresas y documentos DD.
 * Autenticación por `x-api-key` (INTEGRACION_API_KEY); en local no se exige clave.
 */
export const ddIntegracionController = {
  async documentos(request: Request): Promise<NextResponse> {
    if (!validarIntegracionM2M(request)) {
      return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    }

    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = ddIntegracionDocumentosQuerySchema.safeParse(params);
    if (!parsed.success) {
      return error(
        API_ERROR_CODES.VALIDATION,
        parsed.error.issues.map((issue) => issue.message).join("; "),
        400,
      );
    }

    try {
      const resultado = await services.ddIntegracion.buscarDocumentos(parsed.data);
      return success(mapDdIntegracionDocumentosToDTO(resultado));
    } catch (err) {
      if (err instanceof DomainError) {
        return error(err.code, err.message, err.status);
      }
      throw err;
    }
  },
};
