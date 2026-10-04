import { NextResponse } from "next/server";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { getSession } from "@/lib/server/auth";
import { services } from "@/lib/server/services";
import { firmarContratoSchema, borradorContratoSchema, generarContratoSchema } from "@/validators/contratos.validator";

export const contratoController = {
  /** Genera el contrato de exhibicion de la solicitud (DOCX/PDF) y lo adjunta. */
  async generar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const parsed = generarContratoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const resultado = await services.contrato.generar({
      ...parsed.data,
      userSub: session.sub,
      userPermissions: session.permissions,
    });
    return success(resultado);
  },

  /** Firma digitalmente el contrato con la imagen de firma del perfil (equivale a subirlo firmado). */
  async firmar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const parsed = firmarContratoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const resultado = await services.contrato.firmar({
      ...parsed.data,
      userSub: session.sub,
      userPermissions: session.permissions,
    });
    return success(resultado);
  },

  /** Borrador del contrato del wizard: NO crea la solicitud (se crea al enviar). */
  async generarBorrador(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const parsed = borradorContratoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const resultado = await services.contrato.generarBorrador({ ...parsed.data, email: session.email });
    return success(resultado);
  },

  /** Firma digital del borrador con la imagen de firma del perfil. */
  async firmarBorrador(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const parsed = borradorContratoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const resultado = await services.contrato.firmarBorrador({ ...parsed.data, email: session.email });
    return success(resultado);
  },
};
