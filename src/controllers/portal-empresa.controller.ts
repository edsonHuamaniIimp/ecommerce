import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES, SESION } from "@/lib/shared/constants";
import { getSession, signToken } from "@/lib/server/auth";
import { setTokenCookie } from "@/lib/server/utils/cookie";
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
    const { empresa, correoNuevo } = await services.empresas.validarDatosPortal(session.email, body);
    const res = success(mapEmpresaToDTO(empresa));
    /* La cuenta (usuario = RUC) adopto el correo del representante: renueva la sesion. */
    if (correoNuevo) {
      const token = await signToken(
        {
          sub: session.sub,
          email: correoNuevo,
          name: session.name,
          roles: session.roles,
          permissions: session.permissions,
          ...(session.eventoId
            ? {
                eventoId: session.eventoId,
                eventoPadreId: session.eventoPadreId,
                tipoEvento: session.tipoEvento,
                codigoEvento: session.codigoEvento,
                eventoNombre: session.eventoNombre,
                eventoPadreNombre: session.eventoPadreNombre,
              }
            : {}),
        },
        SESION.JWT_EXPIRACION_ESTANDAR,
      );
      setTokenCookie(res, token, SESION.MAX_AGE_ESTANDAR);
    }
    return res;
  },
};
