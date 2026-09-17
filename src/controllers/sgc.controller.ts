import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { getSession } from "@/lib/server/auth";

export const sgcController = {
  async detalle(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const solicitudId = new URL(request.url).searchParams.get("solicitudId")?.trim();
    if (!solicitudId) return error(API_ERROR_CODES.VALIDATION, "solicitudId requerido", 400);

    const detalle = await services.sgc.consultarExpediente(solicitudId);
    if (!detalle) return error(API_ERROR_CODES.NOT_FOUND, "El expediente aun no existe en el SGC", 404);
    return success(detalle);
  },

  async sincronizar(): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const sincronizados = await services.sgc.reconciliar();
    return success({ sincronizados });
  },

  async descarga(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const solicitudId = new URL(request.url).searchParams.get("solicitudId")?.trim();
    if (!solicitudId) return error(API_ERROR_CODES.VALIDATION, "solicitudId requerido", 400);

    const enlace = await services.sgc.obtenerDescargaContrato(solicitudId);
    if (!enlace) return error(API_ERROR_CODES.NOT_FOUND, "No hay contrato firmado disponible", 404);
    return success(enlace);
  },

  async subsanar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const body = (await request.json()) as { solicitudId?: string; documentId?: string; url?: string; title?: string };
    if (!body.solicitudId || !body.documentId || !body.url) {
      return error(API_ERROR_CODES.VALIDATION, "solicitudId, documentId y url requeridos", 400);
    }

    const documento = await services.sgc.subsanarContrato(body.solicitudId, {
      url: body.url,
      title: body.title ?? "Contrato corregido",
      documentId: body.documentId,
    });
    if (!documento) return error(API_ERROR_CODES.INTERNAL, "No se pudo registrar la subsanacion", 500);
    return success(documento);
  },
};
