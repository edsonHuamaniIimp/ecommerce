import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { reservaRequestSchema } from "@/validators/reserva.validator";
import { getSession } from "@/lib/server/auth";
import { requestMetadata } from "@/lib/server/request-metadata";

export const reservaController = {
  async crearHold(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const body = await request.json() as { standIds?: string[] };
    if (!Array.isArray(body.standIds) || body.standIds.length === 0) {
      return error(API_ERROR_CODES.VALIDATION, "Selecciona al menos un stand", 400);
    }
    if (!session.eventoId) return error(API_ERROR_CODES.VALIDATION, "Evento no seleccionado", 400);
    const hold = await services.reservas.crearHold(body.standIds, session.eventoId, session.sub, session.email);
    return success(hold);
  },

  async liberarHold(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const body = await request.json() as { holdId?: string };
    if (!body.holdId) return error(API_ERROR_CODES.VALIDATION, "holdId requerido", 400);
    const liberados = await services.reservas.liberarHold(body.holdId, session.sub);
    return success({ liberados });
  },

  async crear(request: Request): Promise<NextResponse> {
    const session = await getSession();
    const raw = await request.json();
    const body = reservaRequestSchema.parse(raw);
    const result = await services.reservas.crear({
      ...body,
      userEmail: session?.email,
      userSub: session?.sub,
      eventoId: session?.eventoId,
      ip: requestMetadata(request).ip,
    });
    if (!result.ok) {
      return error(API_ERROR_CODES.CONFLICT, "Algunos stands ya estan reservados", 409);
    }
    if (result.solicitudId) {
      const meta = requestMetadata(request);
      await services.auditoria.registrar({
        tipo: "solicitudes",
        entidad: `solicitud:${result.solicitudId}`,
        actor: session?.sub ?? null,
        mensaje: "Solicitud creada",
        ip: meta.ip,
        userAgent: meta.userAgent,
        metodo: meta.metodo,
        ruta: meta.ruta,
        metadata: { accion: "crear" },
      }).catch(() => {});
    }
    return success({ ok: true, message: result.message, solicitudId: result.solicitudId ?? null });
  },
};
