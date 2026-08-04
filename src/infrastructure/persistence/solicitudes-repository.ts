import { prisma } from "@/lib/db";
import type { ISolicitudesRepository, SolicitudesListParams, SolicitudesPaginatedResult } from "@/domain/ports/solicitudes-repository";
import type { SolicitudRow, RevisionEntity, RevisionHistorialEntity, ReevaluacionEntity } from "@/domain/models/entities";
import { REVISION_AREAS, REVISION_AREA_ORDER } from "@/lib/constants";

function mapRevision(r: Record<string, unknown>): RevisionEntity {
  return {
    id: r.id as string,
    solicitudId: r.solicitudId as string,
    area: r.area as string,
    estado: r.estado as string,
    comentario: r.comentario as string | null,
    createdBy: r.createdBy as string | null,
    updatedBy: r.updatedBy as string | null,
    createdAt: r.createdAt as Date,
    updatedAt: r.updatedAt as Date,
  };
}

function computeEstadoSolicitud(revisiones: RevisionEntity[]): string {
  if (revisiones.length === 0) return "pendiente";
  const todasPendientes = revisiones.every((r) => r.estado === "pendiente");
  if (todasPendientes) return "pendiente";
  const algunaRespondio = revisiones.some((r) => r.estado !== "pendiente");
  const todasRespondieron = REVISION_AREA_ORDER.every((area) => {
    const rev = revisiones.find((r) => r.area === area);
    return rev && rev.estado !== "pendiente";
  });
  if (!todasRespondieron && algunaRespondio) return "en_proceso";
  if (todasRespondieron) {
    const algunaRechazada = revisiones.some((r) => r.estado === "rechazado");
    return algunaRechazada ? "rechazado" : "aprobado";
  }
  return "pendiente";
}

async function mapRow(row: Record<string, unknown>): Promise<SolicitudRow> {
  const solicitudId = row.id as string;
  const gessStandId = row.gessStandId as string | null;
  const revisiones = (row.revisiones as Record<string, unknown>[])?.map(mapRevision) ?? [];
  const reevaluaciones = (row.reevaluaciones as Record<string, unknown>[])?.map((r) => ({
    id: r.id as string,
    solicitudId: r.solicitudId as string,
    estado: r.estado as string,
    motivo: r.motivo as string | null,
    documentos: r.documentos,
    createdBy: r.createdBy as string | null,
    updatedBy: r.updatedBy as string | null,
    createdAt: r.createdAt as Date,
    updatedAt: r.updatedAt as Date,
  })) ?? [];

  let standCode = "";
  let standCodes: string[] = [];
  let tipoStand: string | null = null;
  let medidas: string | null = null;
  let empresa: string | null = null;
  let bloqueId: string | null = null;
  let estado: string | null = null;
  let imagenes: unknown = [];
  let documentos: unknown = [];

  if (gessStandId) {
    const stand = (row.gessStand ?? row) as Record<string, unknown>;
    standCode = stand.standCode as string;
    standCodes = [standCode];
    tipoStand = stand.tipoStand as string | null;
    medidas = stand.medidas as string | null;
    empresa = stand.empresa as string | null;
    bloqueId = stand.bloqueId as string | null;
    estado = stand.estado as string | null;
    imagenes = stand.imagenes ?? [];
    documentos = (row.documentos as unknown[] | null)?.length ? row.documentos : stand.documentos ?? [];
  } else {
    const stands = await prisma.solicitudStand.findMany({
      where: { solicitudId },
      include: { gessStand: true },
    });
    standCodes = stands.map((s) => s.gessStand.standCode);
    standCode = standCodes.join(", ");
    if (stands.length > 0) {
      const first = stands[0].gessStand;
      tipoStand = first.tipoStand;
      medidas = first.medidas;
      estado = first.estado;
      bloqueId = first.bloqueId;
      imagenes = first.imagenes ?? [];
    }
    documentos = row.documentos ?? [];
  }

    const docsList = ((row.docsAdjuntos as Record<string, unknown>[]) ?? []).map((d) => ({
      id: d.id as string,
      url: d.url as string,
      nombre: d.nombre as string,
      userId: d.userId as string | null,
      uploadedBy: d.uploadedBy as string | null,
      createdAt: d.createdAt as Date,
    }));

    return {
    id: solicitudId,
    gessStandId,
    standCode,
    standCodes,
    tipoStand,
    medidas,
    empresa,
    email: row.email as string | null,
    userId: row.userId as string | null,
    bloqueId,
    estado,
    estadoSolicitud: (row.estado as string) || computeEstadoSolicitud(revisiones),
    flgActivo: row.flgActivo as boolean ?? true,
    documentos,
    imagenes,
    docsAdjuntosCount: ((row._count as Record<string, unknown>)?.docsAdjuntos as number) ?? 0,
    clienteDocsAdjuntosCount: docsList.filter((d) => d.userId === (row.userId as string | null)).length,
    docsAdjuntos: docsList,
    updatedAt: row.updatedAt as Date,
    revisiones,
    reevaluaciones,
    revisionComunicacion: revisiones.find((r) => r.area === REVISION_AREAS.COMUNICACION) ?? null,
    revisionLegal: revisiones.find((r) => r.area === REVISION_AREAS.LEGAL) ?? null,
    revisionLogistica: revisiones.find((r) => r.area === REVISION_AREAS.LOGISTICA) ?? null,
  };
}

export class SolicitudesPrismaRepository implements ISolicitudesRepository {
  async listar(params: SolicitudesListParams): Promise<SolicitudesPaginatedResult> {
    const where: Record<string, unknown> = {};
    if (params.eventoId) {
      where.OR = [
        { gessStand: { eventoId: params.eventoId } },
        { stands: { some: { gessStand: { eventoId: params.eventoId } } } },
      ];
    }
    if (params.userId) {
      where.userId = params.userId;
    }

    const [total, rows] = await Promise.all([
      prisma.solicitud.count({ where: where as never }),
      prisma.solicitud.findMany({
        where: where as never,
        include: {
          gessStand: true,
          revisiones: true,
          reevaluaciones: { orderBy: { createdAt: "desc" } },
          docsAdjuntos: { where: { flgActivo: true } },
          _count: { select: { docsAdjuntos: { where: { flgActivo: true } } } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
    ]);

    const data = await Promise.all(rows.map((r) => mapRow(r as unknown as Record<string, unknown>)));

    return {
      data,
      total,
      page: params.page,
      perPage: params.perPage,
      totalPages: Math.ceil(total / params.perPage),
    };
  }

  async detalle(solicitudId: string): Promise<SolicitudRow | null> {
    const row = await prisma.solicitud.findUnique({
      where: { id: solicitudId },
      include: {
        gessStand: true,
        revisiones: true,
        reevaluaciones: { orderBy: { createdAt: "desc" } },
        docsAdjuntos: { where: { flgActivo: true } },
        _count: { select: { docsAdjuntos: { where: { flgActivo: true } } } },
      },
    });
    if (!row) return null;
    return mapRow(row as unknown as Record<string, unknown>);
  }

  async crearOActualizarRevision(data: {
    solicitudId: string;
    area: string;
    estado: string;
    comentario?: string;
    reviewerEmail: string;
  }): Promise<RevisionEntity> {
    const existing = await prisma.revision.findUnique({
      where: { solicitudId_area: { solicitudId: data.solicitudId, area: data.area } },
    });

    if (existing) {
      await prisma.revisionHistorial.create({
        data: {
          solicitudId: existing.solicitudId,
          area: existing.area,
          estadoAnterior: existing.estado,
          comentarioAnterior: existing.comentario,
          motivo: existing.estado !== data.estado ? `cambio a ${data.estado}` : "actualizo justificacion",
          createdBy: data.reviewerEmail,
        },
      });

      const updated = await prisma.revision.update({
        where: { id: existing.id },
        data: {
          estado: data.estado,
          comentario: data.comentario ?? null,
          updatedBy: data.reviewerEmail,
        },
      });
      return mapRevision(updated as unknown as Record<string, unknown>);
    }

    const created = await prisma.revision.create({
      data: {
        solicitudId: data.solicitudId,
        area: data.area,
        estado: data.estado,
        comentario: data.comentario ?? null,
        createdBy: data.reviewerEmail,
        updatedBy: data.reviewerEmail,
      },
    });
    return mapRevision(created as unknown as Record<string, unknown>);
  }

  async crearRevisionInicial(solicitudId: string, area: string): Promise<RevisionEntity> {
    const created = await prisma.revision.create({
      data: { solicitudId, area, estado: "pendiente" },
    });
    return mapRevision(created as unknown as Record<string, unknown>);
  }

  async crearSolicitud(standIds: string[], userId?: string, email?: string): Promise<string> {
    const created = await prisma.solicitud.create({
      data: {
        gessStandId: standIds.length === 1 ? standIds[0] : null,
        userId: userId ?? null,
        email: email ?? null,
      },
    });

    if (standIds.length > 1) {
      for (const standId of standIds) {
        await prisma.solicitudStand.create({
          data: { solicitudId: created.id, gessStandId: standId },
        });
      }
    }

    return created.id;
  }

  async crearAlertaReserva(data: { userId: string; tipo: string; titulo: string; mensaje: string; url?: string }): Promise<void> {
    await prisma.alerta.create({ data });
  }

  async crearReevaluacion(solicitudId: string, estado: string, motivo: string | null, documentos: unknown, createdBy: string): Promise<ReevaluacionEntity> {
    const created = await prisma.reevaluacion.create({
      data: { solicitudId, estado, motivo, documentos: documentos ?? [], createdBy, updatedBy: createdBy },
    });
    return { id: created.id, solicitudId: created.solicitudId, estado: created.estado, motivo: created.motivo, documentos: created.documentos, createdBy: created.createdBy, updatedBy: created.updatedBy, createdAt: created.createdAt, updatedAt: created.updatedAt };
  }

  async tieneReevaluacionPendiente(solicitudId: string): Promise<boolean> {
    const exist = await prisma.reevaluacion.findFirst({ where: { solicitudId, estado: "pendiente" } });
    return !!exist;
  }

  async atenderReevaluacionAprobacion(reevaluacionId: string, reviewerEmail: string): Promise<void> {
    const reevaluacion = await prisma.reevaluacion.findUnique({ where: { id: reevaluacionId } });
    if (!reevaluacion) throw new Error("NOT_FOUND");

    const revisiones = await prisma.revision.findMany({ where: { solicitudId: reevaluacion.solicitudId } });
    for (const rev of revisiones) {
      await prisma.revisionHistorial.create({
        data: { solicitudId: rev.solicitudId, area: rev.area, estadoAnterior: rev.estado, comentarioAnterior: rev.comentario, motivo: "aprobacion de re-evaluacion", createdBy: reviewerEmail },
      });
      await prisma.revision.update({ where: { id: rev.id }, data: { estado: "pendiente", comentario: null, updatedBy: reviewerEmail } });
    }
    await prisma.reevaluacion.update({ where: { id: reevaluacionId }, data: { estado: "aprobado", updatedBy: reviewerEmail } });

    if (reevaluacion.documentos && Array.isArray(reevaluacion.documentos) && reevaluacion.documentos.length > 0) {
      await prisma.solicitud.update({ where: { id: reevaluacion.solicitudId }, data: { documentos: reevaluacion.documentos as never } });
    }
  }

  async atenderReevaluacionRechazo(reevaluacionId: string, reviewerEmail: string): Promise<void> {
    const reevaluacion = await prisma.reevaluacion.findUnique({ where: { id: reevaluacionId } });
    if (!reevaluacion) throw new Error("NOT_FOUND");

    await prisma.reevaluacion.update({ where: { id: reevaluacionId }, data: { estado: "rechazado", updatedBy: reviewerEmail } });

    const solicitud = await prisma.solicitud.findUnique({ where: { id: reevaluacion.solicitudId }, select: { gessStandId: true } });
    if (solicitud?.gessStandId) {
      await prisma.gessStand.update({ where: { id: solicitud.gessStandId }, data: { estado: "disponible" } });
    } else {
      const stands = await prisma.solicitudStand.findMany({ where: { solicitudId: reevaluacion.solicitudId }, select: { gessStandId: true } });
      for (const s of stands) {
        await prisma.gessStand.update({ where: { id: s.gessStandId }, data: { estado: "disponible" } });
      }
    }
    await prisma.revision.deleteMany({ where: { solicitudId: reevaluacion.solicitudId } });
  }

  async darDeBajaSolicitud(solicitudId: string): Promise<void> {
    const solicitud = await prisma.solicitud.findUnique({ where: { id: solicitudId }, select: { gessStandId: true, flgActivo: true } });
    if (!solicitud || !solicitud.flgActivo) throw new Error("NOT_FOUND");

    await prisma.solicitud.update({ where: { id: solicitudId }, data: { flgActivo: false } });

    if (solicitud.gessStandId) {
      await prisma.gessStand.update({ where: { id: solicitud.gessStandId }, data: { estado: "disponible" } });
    } else {
      const stands = await prisma.solicitudStand.findMany({ where: { solicitudId }, select: { gessStandId: true } });
      for (const s of stands) {
        await prisma.gessStand.update({ where: { id: s.gessStandId }, data: { estado: "disponible" } });
      }
    }
  }

  async marcarOrdenPago(solicitudId: string): Promise<void> {
    await prisma.solicitud.update({ where: { id: solicitudId }, data: { estado: "pendiente_pago" } });
  }

  async obtenerHistorial(solicitudId: string): Promise<{ revisiones: RevisionEntity[]; historial: RevisionHistorialEntity[] }> {
    const [revisiones, historial] = await Promise.all([
      prisma.revision.findMany({
        where: { solicitudId },
        select: { area: true, estado: true, comentario: true, createdBy: true, updatedBy: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.revisionHistorial.findMany({
        where: { solicitudId },
        select: { area: true, estadoAnterior: true, comentarioAnterior: true, motivo: true, createdBy: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    return {
      revisiones: revisiones.map((r) => ({
        id: r.createdAt?.toISOString() ?? "",
        solicitudId,
        area: r.area,
        estado: r.estado,
        comentario: r.comentario,
        createdBy: r.createdBy,
        updatedBy: r.updatedBy,
        createdAt: r.createdAt ?? new Date(),
        updatedAt: r.updatedAt ?? new Date(),
      })),
      historial: historial.map((h) => ({
        id: h.createdAt.toISOString(),
        solicitudId,
        area: h.area,
        estadoAnterior: h.estadoAnterior,
        comentarioAnterior: h.comentarioAnterior,
        motivo: h.motivo,
        createdBy: h.createdBy,
        createdAt: h.createdAt,
      })),
    };
  }

  async crearDocumentoAdjunto(solicitudId: string, url: string, nombre: string, userId: string | null, email: string): Promise<Record<string, unknown>> {
    const doc = await prisma.solicitudDocumento.create({
      data: { solicitudId, url, nombre, uploadedBy: email, userId },
    });
    return doc as unknown as Record<string, unknown>;
  }

  async findDocumento(docId: string) {
    const doc = await prisma.solicitudDocumento.findUnique({ where: { id: docId }, select: { id: true, userId: true } });
    return doc ?? null;
  }

  async eliminarDocumento(docId: string) {
    await prisma.solicitudDocumento.update({ where: { id: docId }, data: { flgActivo: false } });
  }
}
