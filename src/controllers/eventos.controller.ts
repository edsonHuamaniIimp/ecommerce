import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES, PERMISSIONS } from "@/lib/shared/constants";
import { getSession } from "@/lib/server/auth";
import { createEventoSchema, updateEventoSchema } from "@/validators/eventos.validator";

/** Permite si tiene admin:full o todos los permisos indicados. */
function puede(permissions: string[], ...requeridos: string[]): boolean {
  return permissions.includes(PERMISSIONS.ADMIN_FULL) || requeridos.every((p) => permissions.includes(p));
}

export const eventosController = {
  async listar(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("presala") === "1") {
      return success(await services.presala.listarPresala());
    }

    const id = searchParams.get("id");
    if (id) {
      const evento = await services.eventos.obtenerPorId(id);
      if (!evento) return error(API_ERROR_CODES.NOT_FOUND, "Evento no encontrado", 404);
      return success(evento);
    }

    return success(await services.presala.listarTodas());
  },

  /** Config del modal informativo de /mapa por version de evento. */
  async modalInfo(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const tipoEvento = Number(searchParams.get("tipoEvento"));
    const codigoEvento = Number(searchParams.get("codigoEvento"));
    if (!Number.isFinite(tipoEvento) || !Number.isFinite(codigoEvento)) {
      return error(API_ERROR_CODES.VALIDATION, "tipoEvento y codigoEvento son requeridos", 400);
    }
    return success(await services.eventos.obtenerModalInfo(tipoEvento, codigoEvento));
  },

  async crear(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!puede(session.permissions, PERMISSIONS.EVENTS_CREATE)) {
      return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para crear eventos", 403);
    }
    const raw = await request.json();
    const body = createEventoSchema.parse(raw);
    return success(await services.eventos.crear({
      eventoPadreId: body.evento_padre_id,
      anio: body.anio,
      fechaInicio: body.fecha_inicio,
      fechaFin: body.fecha_fin,
    }), { status: 201 });
  },

  async actualizar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const raw = await request.json();
    const body = updateEventoSchema.parse(raw);

    const tocaEdicion =
      body.anio !== undefined || body.fecha_inicio !== undefined || body.fecha_fin !== undefined ||
      body.plano !== undefined || body.imagen !== undefined || body.modal_info !== undefined ||
      body.tipo_evento !== undefined || body.codigo_evento !== undefined;
    const tocaToggle = body.estado !== undefined || body.flg_visible !== undefined || body.flg_activo !== undefined;

    if (tocaEdicion && !puede(session.permissions, PERMISSIONS.EVENTS_EDIT)) {
      return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para editar eventos", 403);
    }
    if (tocaToggle && !puede(session.permissions, PERMISSIONS.EVENTS_TOGGLE)) {
      return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para activar/cerrar eventos", 403);
    }

    return success(await services.eventos.actualizar(body));
  },
};
