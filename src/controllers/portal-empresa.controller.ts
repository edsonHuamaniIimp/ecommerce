import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { getSession } from "@/lib/server/auth";
import { mapEmpresaToDTO } from "@/lib/shared/mappers/empresa";
import { validarDatosEmpresaSchema } from "@/validators/empresas.validator";
import type { ValidarDatosEmpresaRequestDTO } from "@/types/dto/empresas";

/** Endpoints del Portal del Cliente para la empresa del propio usuario. */
export const portalEmpresaController = {
  /** Datos de la empresa vinculada al usuario (para el primer ingreso / Mi empresa). */
  async misDatos(): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const empresa = await services.empresas.obtenerDatosPortal(session.email);
    return success(mapEmpresaToDTO(empresa));
  },

  /** Validacion/actualizacion de los datos contractuales en el primer ingreso. */
  async validar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const parsed = validarDatosEmpresaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    const body: ValidarDatosEmpresaRequestDTO = parsed.data;
    const empresa = await services.empresas.validarDatosPortal(session.email, body);
    return success(mapEmpresaToDTO(empresa));
  },
};
