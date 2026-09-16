import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { prisma } from "@/lib/server/db";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { sendEmail } from "@/lib/server/email";
import { getSession } from "@/lib/server/auth";
import { solicitudesListarSchema, solicitudesDetalleSchema, solicitudesRevisarSchema } from "@/validators/solicitudes.validator";
import { REVISION_AREA_ORDER, REVISION_AREA_LABELS, RESULTADOS_APROBACION, ESTADOS_REEVALUACION } from "@/lib/shared/constants";
import { buildRevisionEmail } from "@/lib/server/email-templates";

export const solicitudesController = {
  async listar(request: Request): Promise<NextResponse> {
    const url = new URL(request.url);
    const parsed = solicitudesListarSchema.parse({
      eventoId: url.searchParams.get("eventoId") ?? "",
      page: url.searchParams.get("page") ?? "1",
      per_page: url.searchParams.get("per_page") ?? "10",
      search: url.searchParams.get("search") ?? undefined,
    });
    const userId = url.searchParams.get("userId") ?? undefined;
    const result = await services.solicitudes.listar({
      eventoId: parsed.eventoId,
      page: parsed.page,
      perPage: parsed.per_page,
      search: parsed.search,
      userId,
    });
    return success(result);
  },

  async detalle(request: Request): Promise<NextResponse> {
    const url = new URL(request.url);
    const { id } = solicitudesDetalleSchema.parse({ id: url.searchParams.get("id") ?? "" });
    const row = await services.solicitudes.detalle(id);
    if (!row) return error(API_ERROR_CODES.NOT_FOUND, "Solicitud no encontrada", 404);
    return success(row);
  },

  async revisar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const body = solicitudesRevisarSchema.parse(await request.json());
    return success(await services.solicitudes.revisar({ ...body, reviewerEmail: session.email }));
  },

  async notificar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!session.permissions.includes("solicitudes:notify") && !session.permissions.includes("admin:full")) {
      return error(API_ERROR_CODES.FORBIDDEN, "Sin permisos para notificar", 403);
    }
    // Validar contra BD (el JWT puede estar desactualizado si se editaron permisos)
    const { hasDBPermission } = await import("@/lib/server/auth");
    if (!(await hasDBPermission(session, "solicitudes:notify"))) {
      return error(API_ERROR_CODES.FORBIDDEN, "Permiso revocado. Cierra sesion y vuelve a ingresar.", 403);
    }
    const raw = await request.json() as { solicitudId: string; to: string; modo: "automatico" | "personalizado"; mensaje?: string };
    if (!raw.solicitudId || !raw.to || !raw.modo) return error(API_ERROR_CODES.VALIDATION, "Campos requeridos", 400);

    const detalle = await services.solicitudes.detalle(raw.solicitudId);
    if (!detalle) return error(API_ERROR_CODES.NOT_FOUND, "Solicitud no encontrada", 404);
    if (!REVISION_AREA_ORDER.every((area) => detalle.revisiones.find((r) => r.area === area)?.estado !== RESULTADOS_APROBACION.PENDIENTE)) {
      return error(API_ERROR_CODES.CONFLICT, "Faltan revisiones pendientes", 409);
    }

    let nombreUsuario = "Estimad@";
    if (detalle.userId) {
      try {
        const user = await prisma.userRole.findFirst({ where: { userId: detalle.userId }, select: { nombre: true, apellidos: true } });
        if (user?.nombre) nombreUsuario = [user.nombre, user.apellidos].filter(Boolean).join(" ") || user.nombre;
      } catch { /* ok */ }
    }

    const emailData = buildRevisionEmail({
      standCode: detalle.standCode, empresa: detalle.empresa ?? "—",
      nombre: nombreUsuario, email: detalle.email ?? raw.to,
      gessStandId: detalle.id, modo: raw.modo, mensaje: raw.mensaje,
      revisiones: detalle.revisiones.map((r) => ({ area: r.area, estado: r.estado, comentario: r.comentario })),
    });
    const result = await sendEmail({ to: raw.to, ...emailData });
    if (!result) return error(API_ERROR_CODES.INTERNAL, "Error al enviar el correo", 500);
    return success({ ok: true });
  },

  async modificar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const raw = await request.json() as { solicitudId: string; documentos?: string[] };
    if (!raw.solicitudId) return error(API_ERROR_CODES.VALIDATION, "solicitudId requerido", 400);

    const detalle = await services.solicitudes.detalle(raw.solicitudId);
    if (!detalle) return error(API_ERROR_CODES.NOT_FOUND, "Solicitud no encontrada", 404);
    if (detalle.userId && detalle.userId !== session.sub && !session.permissions.includes("admin:full")) {
      return error(API_ERROR_CODES.FORBIDDEN, "No puedes modificar solicitudes de otro usuario", 403);
    }
    if (!REVISION_AREA_ORDER.every((area) => detalle.revisiones.find((r) => r.area === area)?.estado !== RESULTADOS_APROBACION.PENDIENTE)) {
      return error(API_ERROR_CODES.CONFLICT, "La solicitud aun esta en revision", 409);
    }
    for (const rev of detalle.revisiones) {
      await services.solicitudes.revisar({ solicitudId: raw.solicitudId, area: rev.area, estado: RESULTADOS_APROBACION.PENDIENTE, comentario: undefined, reviewerEmail: session.email });
    }
    return success({ ok: true });
  },

  async reevaluar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const raw = await request.json() as { solicitudId: string; motivo?: string; documentos?: string[] };
    if (!raw.solicitudId) return error(API_ERROR_CODES.VALIDATION, "solicitudId requerido", 400);

    if (await services.solicitudes.repo.tieneReevaluacionPendiente(raw.solicitudId)) {
      return error(API_ERROR_CODES.CONFLICT, "Ya existe una solicitud de re-evaluacion pendiente", 409);
    }
    const created = await services.solicitudes.repo.crearReevaluacion(
      raw.solicitudId, ESTADOS_REEVALUACION.PENDIENTE, raw.motivo ?? null, raw.documentos ?? [], session.email,
    );
    return success(created);
  },

  async atenderReevaluacion(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!session.permissions.includes("solicitudes:notify") && !session.permissions.includes("admin:full")) {
      return error(API_ERROR_CODES.FORBIDDEN, "Sin permisos", 403);
    }
    const raw = await request.json() as { reevaluacionId: string; accion: "aprobar" | "rechazar" };
    if (!raw.reevaluacionId || !raw.accion) return error(API_ERROR_CODES.VALIDATION, "reevaluacionId y accion requeridos", 400);

    if (raw.accion === "aprobar") {
      await services.solicitudes.repo.atenderReevaluacionAprobacion(raw.reevaluacionId, session.email);
    } else {
      await services.solicitudes.repo.atenderReevaluacionRechazo(raw.reevaluacionId, session.email);
    }
    return success({ ok: true });
  },

  async darDeBaja(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!session.permissions.includes("admin:full") && !session.permissions.includes("solicitudes:notify")) {
      return error(API_ERROR_CODES.FORBIDDEN, "Sin permisos", 403);
    }
    const raw = await request.json() as { solicitudId: string };
    if (!raw.solicitudId) return error(API_ERROR_CODES.VALIDATION, "solicitudId requerido", 400);
    await services.solicitudes.repo.darDeBajaSolicitud(raw.solicitudId);
    return success({ ok: true });
  },

  async ordenPago(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const raw = await request.json() as { solicitudId: string };
    if (!raw.solicitudId) return error(API_ERROR_CODES.VALIDATION, "solicitudId requerido", 400);
    await services.solicitudes.repo.marcarOrdenPago(raw.solicitudId);
    return success({ ok: true });
  },

  async historial(request: Request): Promise<NextResponse> {
    const gessStandId = new URL(request.url).searchParams.get("id");
    if (!gessStandId) return error(API_ERROR_CODES.VALIDATION, "id requerido", 400);

    const { revisiones, historial } = await services.solicitudes.repo.obtenerHistorial(gessStandId);

    const items: { fecha: string; area: string; accion: string; detalle: string; usuario: string | null; esActual: boolean }[] = [];

    for (const h of historial) {
      const label = REVISION_AREA_LABELS[h.area as keyof typeof REVISION_AREA_LABELS] ?? h.area;
      const esReevaluacion = h.motivo.includes("re-evaluacion");
      const esCambioEstado = h.motivo.startsWith("cambio a ");
      const esActualizacion = h.motivo === "actualizo justificacion";

      let accion: string;
      let estadoPrevio: string;
      let estadoNuevo: string;
      let justificacion: string;

      if (esReevaluacion) {
        accion = "Aprobacion de re-evaluacion"; estadoPrevio = h.estadoAnterior; estadoNuevo = "pendiente"; justificacion = h.comentarioAnterior ?? "";
      } else if (esCambioEstado) {
        accion = "Cambio de estado"; estadoPrevio = h.estadoAnterior; estadoNuevo = h.motivo.replace("cambio a ", ""); justificacion = h.comentarioAnterior ?? "";
      } else if (esActualizacion) {
        accion = "Actualizo justificacion"; estadoPrevio = h.estadoAnterior; estadoNuevo = h.estadoAnterior; justificacion = h.comentarioAnterior ?? "";
      } else {
        accion = h.motivo; estadoPrevio = h.estadoAnterior; estadoNuevo = h.estadoAnterior; justificacion = h.comentarioAnterior ?? "";
      }
      items.push({ fecha: h.createdAt.toISOString(), area: label, accion, detalle: `Estado: ${estadoPrevio} → ${estadoNuevo}${justificacion ? `\nJustificacion: "${justificacion}"` : ""}`, usuario: h.createdBy, esActual: false });
    }

    for (const r of revisiones) {
      const label = REVISION_AREA_LABELS[r.area as keyof typeof REVISION_AREA_LABELS] ?? r.area;
      const estadoLabel = r.estado === "aprobado" ? "Aprobado" : r.estado === "rechazado" ? "Rechazado" : r.estado === "pendiente" ? "Pendiente" : r.estado;
      items.push({ fecha: r.updatedAt.toISOString(), area: label, accion: "Estado actual", detalle: `Estado: ${estadoLabel}${r.comentario ? `\nJustificacion: "${r.comentario}"` : ""}`, usuario: r.updatedBy, esActual: true });
    }

    items.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    return success(items);
  },

  async uploadDocumento(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const raw = await request.json() as { solicitudId: string; url: string; nombre: string };
    if (!raw.solicitudId || !raw.url) return error(API_ERROR_CODES.VALIDATION, "solicitudId y url requeridos", 400);

    const doc = await services.solicitudes.uploadDocumento({
      solicitudId: raw.solicitudId,
      url: raw.url,
      nombre: raw.nombre ?? raw.url.split("/").pop() ?? "documento",
      userSub: session.sub,
      userEmail: session.email,
      userPermissions: session.permissions,
    });
    return success(doc);
  },

  async eliminarDocumento(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const raw = await request.json() as { docId: string };
    if (!raw.docId) return error(API_ERROR_CODES.VALIDATION, "docId requerido", 400);
    await services.solicitudes.eliminarDocumento({ docId: raw.docId, userSub: session.sub, userPermissions: session.permissions });
    return success({ ok: true });
  },
};
