import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES, SGC_DOCUMENT_CATEGORIES, SGC_OUTBOX_OPERACION } from "@/lib/shared/constants";
import type { SgcDocumentCategory } from "@/lib/shared/constants";
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
    if (!documento) {
      await services.sgcOutbox.encolar(SGC_OUTBOX_OPERACION.SUBSANAR, {
        solicitudId: body.solicitudId,
        documentId: body.documentId,
        url: body.url,
        title: body.title ?? "Contrato corregido",
      });
      return error(API_ERROR_CODES.INTERNAL, "No se pudo registrar la subsanacion; se reintentara", 500);
    }
    return success(documento);
  },

  async subirDocumento(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const body = (await request.json()) as {
      solicitudId?: string;
      category?: string;
      title?: string;
      url?: string;
      documentId?: string | null;
    };
    if (!body.solicitudId || !body.category || !body.url) {
      return error(API_ERROR_CODES.VALIDATION, "solicitudId, category y url requeridos", 400);
    }
    if (body.category !== SGC_DOCUMENT_CATEGORIES.CONTRACT && body.category !== SGC_DOCUMENT_CATEGORIES.ANNEX) {
      return error(API_ERROR_CODES.VALIDATION, "category debe ser contract o annex", 400);
    }

    const documento = await services.sgc.subirDocumentoDesdeUrl(body.solicitudId, {
      category: body.category as SgcDocumentCategory,
      title: body.title ?? "Documento",
      url: body.url,
      documentId: body.documentId ?? null,
    });
    if (!documento) return error(API_ERROR_CODES.INTERNAL, "No se pudo subir el documento al SGC", 500);
    return success(documento);
  },

  async subirAnexos(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const body = (await request.json()) as { solicitudId?: string };
    if (!body.solicitudId) return error(API_ERROR_CODES.VALIDATION, "solicitudId requerido", 400);

    try {
      const documentos = await services.sgc.subirAnexosDeSolicitud(body.solicitudId);
      return success({ enviados: documentos.length, documentos });
    } catch {
      await services.sgcOutbox.encolar(SGC_OUTBOX_OPERACION.SUBIR_ANEXOS, { solicitudId: body.solicitudId });
      return error(API_ERROR_CODES.INTERNAL, "No se pudieron subir los anexos; se reintentara", 500);
    }
  },

  async registrar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const body = (await request.json()) as { solicitudId?: string };
    if (!body.solicitudId) return error(API_ERROR_CODES.VALIDATION, "solicitudId requerido", 400);

    const expediente = await services.sgc.crearExpedienteDesdeSolicitud(body.solicitudId);
    if (!expediente?.contractId) {
      if (!services.sgc.estaHabilitado()) {
        return error(API_ERROR_CODES.INTERNAL, "Integracion SGC deshabilitada en el servidor (SGC_ENABLED=0)", 500);
      }
      const registro = await services.sgc.obtenerRegistroLocal(body.solicitudId);
      const causa = registro?.lastError ? `: ${registro.lastError}` : "";
      return error(API_ERROR_CODES.INTERNAL, `No se pudo registrar el expediente en el SGC${causa}`, 500);
    }
    return success(expediente);
  },

  async subirContrato(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const body = (await request.json()) as { solicitudId?: string };
    if (!body.solicitudId) return error(API_ERROR_CODES.VALIDATION, "solicitudId requerido", 400);

    const documento = await services.sgc.subirContratoDeSolicitud(body.solicitudId);
    if (!documento) {
      return error(
        API_ERROR_CODES.VALIDATION,
        "No hay contrato del administrador adjunto a la solicitud (adjunta el contrato v1).",
        400,
      );
    }
    return success(documento);
  },

  /** Declara la casuistica de subsanacion cuando el SGC devolvio (rechazo) el tramite. */
  async declararMotivo(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const body = (await request.json()) as { solicitudId?: string; motivo?: string | null };
    if (!body.solicitudId) return error(API_ERROR_CODES.VALIDATION, "solicitudId requerido", 400);

    /* Motivo libre (la casuÃ­stica no es cerrada); vacÃ­o = limpiar la declaraciÃ³n. */
    const motivo = (body.motivo ?? "").trim().slice(0, 500) || null;
    const expediente = await services.sgc.declararMotivoSubsanacion(body.solicitudId, motivo, session.email);
    if (!expediente) return error(API_ERROR_CODES.NOT_FOUND, "La solicitud no tiene expediente en el SGC", 404);
    return success(expediente);
  },

  /** Reenvia el tramite al SGC tras la devolucion: sube el firmado del cliente y reabre la ronda. */
  async reenviar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const body = (await request.json()) as { solicitudId?: string };
    if (!body.solicitudId) return error(API_ERROR_CODES.VALIDATION, "solicitudId requerido", 400);

    const documento = await services.sgc.reenviarCorreccionAlSgc(body.solicitudId, session.email);
    if (!documento) {
      return error(
        API_ERROR_CODES.VALIDATION,
        "Falta el contrato firmado del cliente (o el expediente no tiene contrato en el SGC).",
        400,
      );
    }
    return success(documento);
  },
};
