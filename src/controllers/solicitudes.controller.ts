import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import type { SolicitudesFiltroSgc, SolicitudesOrden } from "@/lib/shared/constants";
import { getSession } from "@/lib/server/auth";
import { solicitudesListarSchema, solicitudesDetalleSchema, solicitudesRevisarSchema, solicitudesNotificarSchema, solicitudesReenviarObservacionSchema, solicitudesHabilitarContratoSchema, uploadDocumentoSchema, solicitudesRecortePlanoSchema } from "@/validators/solicitudes.validator";
import { REVISION_AREA_LABELS, REVISION_AREA_PERMISSIONS, RESULTADOS_APROBACION, ESTADOS_REEVALUACION, ESTADOS_REVISION, PERMISSIONS } from "@/lib/shared/constants";
import { areasRevisionLocal } from "@/lib/shared/utils/revision-areas";
import { mapDdEvaluacionSolicitudToDTO } from "@/lib/shared/mappers/debida-diligencia";
import { requestMetadata } from "@/lib/server/request-metadata";

/** Registra un evento de auditoria sin tocar una solicitud concreta. */
async function auditarEntidad(
  request: Request,
  session: { sub: string },
  entidad: string,
  accion: string,
  mensaje: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const requestMeta = requestMetadata(request);
  await services.auditoria
    .registrar({
      tipo: "solicitudes",
      entidad,
      actor: session.sub,
      mensaje,
      ip: requestMeta.ip,
      userAgent: requestMeta.userAgent,
      metodo: requestMeta.metodo,
      ruta: requestMeta.ruta,
      metadata: { accion, ...metadata },
    })
    .catch(() => {});
}

/** Registra la operacion en el log central y actualiza la auditoria de la fila. */
async function auditarOperacion(
  request: Request,
  session: { sub: string },
  accion: string,
  solicitudId: string,
  mensaje: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const requestMeta = requestMetadata(request);
  await services.solicitudes.repo
    .touchAuditoria(solicitudId, session.sub, requestMeta.ip)
    .catch(() => {});
  await services.auditoria
    .registrar({
      tipo: "solicitudes",
      entidad: `solicitud:${solicitudId}`,
      actor: session.sub,
      mensaje,
      ip: requestMeta.ip,
      userAgent: requestMeta.userAgent,
      metodo: requestMeta.metodo,
      ruta: requestMeta.ruta,
      metadata: { accion, ...metadata },
    })
    .catch(() => {});
}

/** True si el usuario puede ver/operar solicitudes de terceros (staff/admin). */
function puedeVerTodas(session: { permissions: string[] }): boolean {
  return (
    session.permissions.includes(PERMISSIONS.SOLICITUDES_GESTION) ||
    session.permissions.includes(PERMISSIONS.SOLICITUDES_NOTIFY) ||
    session.permissions.includes(PERMISSIONS.ADMIN_FULL)
  );
}

export const solicitudesController = {
  async listar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const url = new URL(request.url);
    const parsed = solicitudesListarSchema.parse({
      eventoId: url.searchParams.get("eventoId") ?? "",
      page: url.searchParams.get("page") ?? "1",
      per_page: url.searchParams.get("per_page") ?? "10",
      search: url.searchParams.get("search") ?? undefined,
      estado: url.searchParams.get("estado") ?? undefined,
      empresa: url.searchParams.get("empresa") ?? undefined,
      standCode: url.searchParams.get("standCode") ?? undefined,
      areaPendiente: url.searchParams.get("areaPendiente") ?? undefined,
      sgc: url.searchParams.get("sgc") ?? undefined,
      docsObservados: url.searchParams.get("docsObservados") ?? undefined,
      desde: url.searchParams.get("desde") ?? undefined,
      hasta: url.searchParams.get("hasta") ?? undefined,
      orden: url.searchParams.get("orden") ?? undefined,
    });
    /* Scoping de dueno: el cliente solo ve sus solicitudes; el staff puede filtrar. */
    const userId = puedeVerTodas(session) ? (url.searchParams.get("userId") ?? undefined) : session.sub;
    const result = await services.solicitudes.listar({
      eventoId: parsed.eventoId,
      page: parsed.page,
      perPage: parsed.per_page,
      search: parsed.search,
      userId,
      estado: parsed.estado,
      empresa: parsed.empresa,
      standCode: parsed.standCode,
      areaPendiente: parsed.areaPendiente,
      sgc: parsed.sgc as SolicitudesFiltroSgc | undefined,
      docsObservados: parsed.docsObservados === "true",
      desde: parsed.desde,
      hasta: parsed.hasta,
      orden: parsed.orden as SolicitudesOrden,
    });
    const data = await Promise.all(result.data.map(async (row) => {
      try {
        const evaluacion = await services.debidaDiligencia.evaluacionDeUsuario(
          row.email,
          parsed.eventoId,
          row.empresa,
        );
        return { ...row, ddEstado: mapDdEvaluacionSolicitudToDTO(row.id, evaluacion) };
      } catch {
        return row;
      }
    }));
    return success({ ...result, data });
  },

  async detalle(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const url = new URL(request.url);
    const { id } = solicitudesDetalleSchema.parse({ id: url.searchParams.get("id") ?? "" });
    const row = await services.solicitudes.detalle(id);
    if (!row) return error(API_ERROR_CODES.NOT_FOUND, "Solicitud no encontrada", 404);
    if (!puedeVerTodas(session) && row.userId && row.userId !== session.sub) {
      return error(API_ERROR_CODES.FORBIDDEN, "No puedes ver solicitudes de otro usuario", 403);
    }
    return success(row);
  },

  /** Estado de DD de la empresa de la solicitud (para bloquear su revision). */
  async ddEstado(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const url = new URL(request.url);
    const { id } = solicitudesDetalleSchema.parse({ id: url.searchParams.get("id") ?? "" });
    const row = await services.solicitudes.detalle(id);
    if (!row) return error(API_ERROR_CODES.NOT_FOUND, "Solicitud no encontrada", 404);
    if (!puedeVerTodas(session) && row.userId && row.userId !== session.sub) {
      return error(API_ERROR_CODES.FORBIDDEN, "No puedes ver solicitudes de otro usuario", 403);
    }
    if (!session.eventoId) {
      return error(API_ERROR_CODES.VALIDATION, "Selecciona un evento activo para continuar", 400);
    }

    const evaluacion = await services.debidaDiligencia.evaluacionDeUsuario(
      row.email,
      session.eventoId,
      row.empresa,
    );
    return success(mapDdEvaluacionSolicitudToDTO(row.id, evaluacion));
  },

  async revisar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const body = solicitudesRevisarSchema.parse(await request.json());

    /* Permiso por area (el admin pasa por admin:full) - validacion en el borde HTTP. */
    const permisoArea = REVISION_AREA_PERMISSIONS[body.area as keyof typeof REVISION_AREA_PERMISSIONS];
    if (!permisoArea) return error(API_ERROR_CODES.VALIDATION, "Area desconocida", 400);
    if (!session.permissions.includes(permisoArea) && !session.permissions.includes(PERMISSIONS.ADMIN_FULL)) {
      return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para revisar esta area", 403);
    }

    /* Bloqueo de negocio: sin DD APTA y vigente no se puede revisar la solicitud. */
    const solicitud = await services.solicitudes.detalle(body.solicitudId);
    if (!solicitud) return error(API_ERROR_CODES.NOT_FOUND, "Solicitud no encontrada", 404);
    if (!session.eventoId) {
      return error(API_ERROR_CODES.VALIDATION, "Selecciona un evento activo para continuar", 400);
    }
    const evaluacionDd = await services.debidaDiligencia.evaluacionDeUsuario(
      solicitud.email,
      session.eventoId,
      solicitud.empresa,
    );
    /* Bypass exclusivo de administradores (admin:full): pueden revisar sin DD APTA. */
    const ddBypassAdmin = !evaluacionDd.aptoParaContratar && session.permissions.includes(PERMISSIONS.ADMIN_FULL);
    if (!evaluacionDd.aptoParaContratar && !ddBypassAdmin) {
      return error(
        API_ERROR_CODES.CONFLICT,
        evaluacionDd.mensaje ?? "La empresa no cuenta con una Debida Diligencia APTA y vigente",
        409,
      );
    }

    const revision = await services.solicitudes.revisar({ ...body, reviewerEmail: session.email });
    await auditarOperacion(
      request,
      session,
      "revisar",
      body.solicitudId,
      `Revisión de ${body.area}: ${body.estado}`,
      { area: body.area, estado: body.estado, revisionId: revision.id, ...(ddBypassAdmin ? { ddBypass: true } : {}) },
    );
    return success(revision);
  },

  /** POST /api/solicitudes/reenviar-observacion — el cliente reenvia tras observar documentos. */
  async reenviarObservacion(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const parsed = solicitudesReenviarObservacionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    await services.solicitudes.reenviarObservacion(parsed.data.solicitudId, session.sub, session.email);
    await auditarOperacion(
      request,
      session,
      "reenviar-observacion",
      parsed.data.solicitudId,
      "El cliente reenvió la solicitud tras una observación",
    );
    return success({ ok: true });
  },

  /** @request SolicitudesNotificarRequestDTO */
  async notificar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const parsed = solicitudesNotificarSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    /* El idioma del destinatario se resuelve via servicio de auth; la autorizacion
       y el envio los decide la capa de aplicacion. */
    const idioma = await services.auth.resolverIdiomaUsuario(parsed.data.to);
    await services.solicitudes.notificarCliente({ ...parsed.data, idioma }, session);
    await auditarOperacion(
      request,
      session,
      "notificar",
      parsed.data.solicitudId,
      "Se notificó al cliente",
      { to: parsed.data.to, modo: parsed.data.modo },
    );
    return success({ ok: true });
  },

  async modificar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const raw = await request.json() as { solicitudId: string; documentos?: string[] };
    if (!raw.solicitudId) return error(API_ERROR_CODES.VALIDATION, "solicitudId requerido", 400);

    const detalle = await services.solicitudes.detalle(raw.solicitudId);
    if (!detalle) return error(API_ERROR_CODES.NOT_FOUND, "Solicitud no encontrada", 404);
    if (detalle.userId && detalle.userId !== session.sub && !session.permissions.includes(PERMISSIONS.ADMIN_FULL)) {
      return error(API_ERROR_CODES.FORBIDDEN, "No puedes modificar solicitudes de otro usuario", 403);
    }
    if (!areasRevisionLocal(detalle.revisiones).every((area) => detalle.revisiones.find((r) => r.area === area)?.estado !== RESULTADOS_APROBACION.PENDIENTE)) {
      return error(API_ERROR_CODES.CONFLICT, "La solicitud aun esta en revision", 409);
    }
    for (const rev of detalle.revisiones) {
      await services.solicitudes.revisar({ solicitudId: raw.solicitudId, area: rev.area, estado: RESULTADOS_APROBACION.PENDIENTE, comentario: undefined, reviewerEmail: session.email });
    }
    await auditarOperacion(request, session, "modificar", raw.solicitudId, "Se reabrió la solicitud para modificación");
    return success({ ok: true });
  },

  async reevaluar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const raw = await request.json() as { solicitudId: string; motivo?: string; documentos?: string[] };
    if (!raw.solicitudId) return error(API_ERROR_CODES.VALIDATION, "solicitudId requerido", 400);

    /* Solo el titular (o admin) puede pedir la re-evaluacion de su solicitud. */
    const detalle = await services.solicitudes.detalle(raw.solicitudId);
    if (!detalle) return error(API_ERROR_CODES.NOT_FOUND, "Solicitud no encontrada", 404);
    if (detalle.userId !== session.sub && !session.permissions.includes(PERMISSIONS.ADMIN_FULL)) {
      return error(API_ERROR_CODES.FORBIDDEN, "No puedes re-evaluar solicitudes de otro usuario", 403);
    }

    if (await services.solicitudes.repo.tieneReevaluacionPendiente(raw.solicitudId)) {
      return error(API_ERROR_CODES.CONFLICT, "Ya existe una solicitud de re-evaluacion pendiente", 409);
    }
    const created = await services.solicitudes.repo.crearReevaluacion(
      raw.solicitudId, ESTADOS_REEVALUACION.PENDIENTE, raw.motivo ?? null, raw.documentos ?? [], session.email,
    );
    await auditarOperacion(request, session, "reevaluar", raw.solicitudId, "Se solicitó una reevaluación", { reevaluacionId: created.id });
    return success(created);
  },

  async atenderReevaluacion(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!session.permissions.includes(PERMISSIONS.SOLICITUDES_NOTIFY) && !session.permissions.includes(PERMISSIONS.ADMIN_FULL)) {
      return error(API_ERROR_CODES.FORBIDDEN, "Sin permisos", 403);
    }
    const raw = await request.json() as { reevaluacionId: string; accion: "aprobar" | "rechazar" };
    if (!raw.reevaluacionId || !raw.accion) return error(API_ERROR_CODES.VALIDATION, "reevaluacionId y accion requeridos", 400);

    if (raw.accion === "aprobar") {
      await services.solicitudes.repo.atenderReevaluacionAprobacion(raw.reevaluacionId, session.email);
    } else {
      await services.solicitudes.repo.atenderReevaluacionRechazo(raw.reevaluacionId, session.email);
    }
    await auditarEntidad(request, session, `reevaluacion:${raw.reevaluacionId}`, "atender-reevaluacion", `Reevaluación ${raw.accion}`, { accion: raw.accion });
    return success({ ok: true });
  },

  async darDeBaja(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!session.permissions.includes(PERMISSIONS.ADMIN_FULL) && !session.permissions.includes(PERMISSIONS.SOLICITUDES_NOTIFY)) {
      return error(API_ERROR_CODES.FORBIDDEN, "Sin permisos", 403);
    }
    const raw = await request.json() as { solicitudId: string };
    if (!raw.solicitudId) return error(API_ERROR_CODES.VALIDATION, "solicitudId requerido", 400);
    await services.solicitudes.repo.darDeBajaSolicitud(raw.solicitudId);
    await auditarOperacion(request, session, "baja", raw.solicitudId, "Se dio de baja la solicitud");
    return success({ ok: true });
  },

  async ordenPago(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (
      !session.permissions.includes(PERMISSIONS.FACTURACION_VIEW) &&
      !session.permissions.includes(PERMISSIONS.SOLICITUDES_NOTIFY) &&
      !session.permissions.includes(PERMISSIONS.ADMIN_FULL)
    ) {
      return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para generar la orden de pago", 403);
    }
    const raw = await request.json() as { solicitudId: string };
    if (!raw.solicitudId) return error(API_ERROR_CODES.VALIDATION, "solicitudId requerido", 400);
    await services.solicitudes.repo.marcarOrdenPago(raw.solicitudId);
    await auditarOperacion(request, session, "orden-pago", raw.solicitudId, "Se generó la orden de pago");
    return success({ ok: true });
  },

  async historial(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const gessStandId = new URL(request.url).searchParams.get("id");
    if (!gessStandId) return error(API_ERROR_CODES.VALIDATION, "id requerido", 400);

    /* Scoping de dueno: el cliente solo ve el historial de sus solicitudes. */
    if (!puedeVerTodas(session)) {
      const solicitud = await services.solicitudes.detalle(gessStandId);
      if (solicitud && solicitud.userId && solicitud.userId !== session.sub) {
        return error(API_ERROR_CODES.FORBIDDEN, "No puedes ver el historial de otro usuario", 403);
      }
    }

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
        accion = "Aprobacion de re-evaluacion"; estadoPrevio = h.estadoAnterior; estadoNuevo = ESTADOS_REVISION.PENDIENTE; justificacion = h.comentarioAnterior ?? "";
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
      const estadoLabel = r.estado === ESTADOS_REVISION.APROBADO ? "Aprobado" : r.estado === ESTADOS_REVISION.RECHAZADO ? "Rechazado" : r.estado === ESTADOS_REVISION.PENDIENTE ? "Pendiente" : r.estado;
      items.push({ fecha: r.updatedAt.toISOString(), area: label, accion: "Estado actual", detalle: `Estado: ${estadoLabel}${r.comentario ? `\nJustificacion: "${r.comentario}"` : ""}`, usuario: r.updatedBy, esActual: true });
    }

    items.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    return success(items);
  },

  /** Habilita la firma del contrato posterior; no genera documento ni cambia el flujo. */
  async habilitarContrato(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const parsed = solicitudesHabilitarContratoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const puedeHabilitar =
      session.permissions.includes(PERMISSIONS.ADMIN_FULL) ||
      session.permissions.includes(PERMISSIONS.SOLICITUDES_UPLOAD) ||
      session.permissions.includes(PERMISSIONS.SOLICITUDES_REVIEW_ASOCIADO) ||
      session.permissions.includes(PERMISSIONS.SOLICITUDES_REVIEW_LEGAL);
    if (!puedeHabilitar) {
      return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para habilitar el contrato", 403);
    }

    await services.solicitudes.habilitarContrato(parsed.data.solicitudId);
    await auditarOperacion(
      request,
      session,
      "habilitar-contrato",
      parsed.data.solicitudId,
      "Habilito la firma del contrato posterior",
    );
    return success({ contratoHabilitado: true });
  },

  async uploadDocumento(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const parsed = uploadDocumentoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    const raw = parsed.data;

    const doc = await services.solicitudes.uploadDocumento({
      solicitudId: raw.solicitudId,
      url: raw.url,
      nombre: raw.nombre ?? raw.url.split("/").pop() ?? "documento",
      userSub: session.sub,
      userEmail: session.email,
      userPermissions: session.permissions,
      tipo: raw.tipo,
      requisito: raw.requisito ?? null,
      permitirAnexosIniciales: raw.permitirAnexosIniciales === true,
      firmaDigital: raw.firmaDigital === true,
    });
    await auditarOperacion(request, session, "upload-documento", raw.solicitudId, "Se adjuntó un documento", { tipo: raw.tipo ?? null, nombre: raw.nombre ?? null });
    return success(doc);
  },

  /** RF-08: guarda la URL de la imagen del recorte del pabellon (generada por el cliente). */
  async guardarRecortePlano(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const parsed = solicitudesRecortePlanoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    await services.solicitudes.guardarRecortePlano({
      solicitudId: parsed.data.solicitudId,
      url: parsed.data.url,
      userSub: session.sub,
      userPermissions: session.permissions,
    });
    await auditarOperacion(request, session, "recorte-plano", parsed.data.solicitudId, "Se actualizó el recorte del plano");
    return success({ ok: true });
  },

  async eliminarDocumento(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const raw = await request.json() as { docId: string };
    if (!raw.docId) return error(API_ERROR_CODES.VALIDATION, "docId requerido", 400);
    const documento = await services.solicitudes.repo.findDocumento(raw.docId);
    await services.solicitudes.eliminarDocumento({ docId: raw.docId, userSub: session.sub, userPermissions: session.permissions });
    if (documento) await auditarOperacion(request, session, "eliminar-documento", documento.solicitudId, "Se eliminó un documento", { docId: raw.docId });
    return success({ ok: true });
  },
};
