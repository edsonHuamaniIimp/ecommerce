import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/server/db";
import type { ISolicitudesRepository, SolicitudesListParams, SolicitudesPaginatedResult } from "@/domain/ports/solicitudes-repository";
import type { SolicitudRow, RevisionEntity, RevisionHistorialEntity, ReevaluacionEntity, PlanCuotasSolicitud, DatosFacturacionSolicitud } from "@/domain/models/entities";
import { REVISION_AREAS, RESULTADOS_APROBACION, ESTADOS_SOLICITUD, ESTADOS_REVISION, ESTADOS_REEVALUACION, ESTADOS_CUOTA, ESTADOS_STAND, ESTADOS_DOCUMENTO_SOLICITUD, IDIOMAS, IIMP_NUMERO_SOLICITUD_PREFIJO, MODOS_PAGO, TIPOS_FACTURACION, TIPOS_DOCUMENTO_SOLICITUD, ORIGENES_DOCUMENTO, MONEDAS, SGC_LIFECYCLE_STATUSES, SOLICITUDES_FILTRO_SGC, normalizarCategorias } from "@/lib/shared/constants";
import { getAppUrl } from "@/lib/server/app-url";
import { getAlertaPlantilla } from "@/lib/shared/alert-templates";
import { areasRevisionLocal } from "@/lib/shared/utils/revision-areas";
import { isSgcEnabled } from "@/lib/server/sgc-config";
import { resolverPrecioStand } from "@/lib/shared/utils/precio-stand";
import { sumarMontos } from "@/lib/shared/utils/importes";
import { documentoDesdeEmailProvisional } from "@/lib/shared/utils/email";
import { usuariosDeEmpresa } from "@/infrastructure/persistence/empresa-usuarios";
import { dateUtils } from "@/lib/shared/utils/date";
import { nombreCompleto } from "@/lib/shared/utils/nombre";
import { codigoComercialStand } from "@/lib/shared/utils/stand-codigo";

type SolicitudConRelaciones = Prisma.SolicitudGetPayload<{
  include: {
    gessStand: true;
    revisiones: true;
    reevaluaciones: true;
    docsAdjuntos: true;
    facturaciones: true;
    sgcExpediente: { include: { _count: { select: { documentos: true } } } };
    _count: { select: { docsAdjuntos: true } };
  };
}>;

interface RevisionRow {
  id: string;
  solicitudId: string;
  area: string;
  estado: string;
  comentario: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRevision(r: RevisionRow): RevisionEntity {
  return {
    id: r.id,
    solicitudId: r.solicitudId,
    area: r.area,
    estado: r.estado,
    comentario: r.comentario,
    createdBy: r.createdBy,
    updatedBy: r.updatedBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    fuePrimeraRevision: false,
  };
}

function computeEstadoSolicitud(revisiones: RevisionEntity[]): string {
  if (revisiones.length === 0) return ESTADOS_SOLICITUD.PENDIENTE;
  const todasPendientes = revisiones.every((r) => r.estado === ESTADOS_REVISION.PENDIENTE);
  if (todasPendientes) return ESTADOS_SOLICITUD.PENDIENTE;
  /* Observacion local: el flujo se detiene hasta que el cliente reemplace y reenvie. */
  if (revisiones.some((r) => r.estado === ESTADOS_REVISION.OBSERVADO)) return ESTADOS_SOLICITUD.OBSERVADO;
  const algunaRespondio = revisiones.some((r) => r.estado !== ESTADOS_REVISION.PENDIENTE);
  const todasRespondieron = areasRevisionLocal(revisiones, { sgcEnabled: isSgcEnabled() }).every((area) => {
    const rev = revisiones.find((r) => r.area === area);
    return rev && rev.estado !== "pendiente";
  });
  if (!todasRespondieron && algunaRespondio) return ESTADOS_SOLICITUD.EN_PROCESO;
  if (todasRespondieron) {
    const algunaRechazada = revisiones.some((r) => r.estado === ESTADOS_REVISION.RECHAZADO);
    return algunaRechazada ? ESTADOS_SOLICITUD.RECHAZADO : ESTADOS_SOLICITUD.APROBADO;
  }
  return ESTADOS_SOLICITUD.PENDIENTE;
}

async function mapRow(row: SolicitudConRelaciones): Promise<SolicitudRow> {
  const solicitudId = row.id;
  const gessStandId = row.gessStandId;
  const revisiones = row.revisiones.map(mapRevision);
  const reevaluaciones = row.reevaluaciones.map((r) => ({
    id: r.id,
    solicitudId: r.solicitudId,
    estado: r.estado,
    motivo: r.motivo,
    documentos: r.documentos,
    createdBy: r.createdBy,
    updatedBy: r.updatedBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  let standCode = "";
  let standCodes: string[] = [];
  let standsDetalle: Array<{ standCode: string; bloqueId: string | null; planoId: string | null; planoCodigo: string | null; planoNombre: string | null }> = [];
  let tipoStand: string | null = null;
  let medidas: string | null = null;
  let empresa: string | null = null;
  let bloqueId: string | null = null;
  let pabellon: string | null = null;
  let ubicacion: string | null = null;
  let estado: string | null = null;
  let imagenes: unknown = [];
  let documentos: unknown = [];
  let documentosCategorias: Record<string, string> = {};
  let standApiId: string | null = null;
  let empresaMontajistaId: string | null = null;
  let empresaMontajistaNombre: string | null = null;
  /* Precio de la reserva (USD): del stand simple o la suma de los stands de la reserva multiple. */
  let precio = 0;

  if (gessStandId) {
    const stand = row.gessStand;
    if (stand) {
      /* El cliente ve el codigo comercial; el prefijo tecnico "BLOQUE-" del plano se omite. */
      standCode = codigoComercialStand(stand.standCode);
      standCodes = [standCode];
      standsDetalle = [{ standCode, bloqueId: stand.bloqueId, planoId: null, planoCodigo: null, planoNombre: null }];
      standApiId = stand.standApiId;
      empresaMontajistaId = stand.montajistaId;
      empresaMontajistaNombre = stand.montajistaNombre;
      tipoStand = stand.tipoStand;
      medidas = stand.medidas;
      precio = resolverPrecioStand(stand);
      empresa = stand.empresa;
      bloqueId = stand.bloqueId;
      pabellon = stand.pabellon;
      ubicacion = stand.ubicacion;
      estado = stand.estado;
      imagenes = stand.imagenes ?? [];
      documentos = Array.isArray(row.documentos) && row.documentos.length > 0 ? row.documentos : stand.documentos ?? [];
      documentosCategorias = normalizarCategorias(stand.documentosCategorias);
    }
  } else {
    const stands = await prisma.solicitudStand.findMany({
      where: { solicitudId },
      include: { gessStand: true },
    });
    standCodes = stands.map((s) => codigoComercialStand(s.gessStand.standCode));
    standsDetalle = stands.map((s) => ({ standCode: codigoComercialStand(s.gessStand.standCode), bloqueId: s.gessStand.bloqueId, planoId: null, planoCodigo: null, planoNombre: null }));
    /* Plano (pabellon) de cada bloque, para agrupar ubicaciones por pabellon. */
    const bloquesReserva = standsDetalle.map((s) => s.bloqueId).filter((v): v is string => Boolean(v));
    if (bloquesReserva.length > 0) {
      const bloquesPlano = await prisma.planoBloque.findMany({
        where: { bloqueId: { in: bloquesReserva } },
        select: { bloqueId: true, plano: { select: { id: true, codigo: true, nombre: true } } },
        orderBy: { plano: { updatedAt: "desc" } },
      });
      const planoPorBloque = new Map<string, { id: string; codigo: string; nombre: string }>();
      for (const b of bloquesPlano) {
        if (!planoPorBloque.has(b.bloqueId) && b.plano) planoPorBloque.set(b.bloqueId, b.plano);
      }
      standsDetalle = standsDetalle.map((s) => {
        const p = s.bloqueId ? (planoPorBloque.get(s.bloqueId) ?? null) : null;
        return { ...s, planoId: p?.id ?? null, planoCodigo: p?.codigo ?? null, planoNombre: p?.nombre ?? null };
      });
    }
    standCode = standCodes.join(", ");
    precio = stands.reduce((sum, s) => sum + resolverPrecioStand(s.gessStand), 0);
    const firstStand = stands[0];
    if (firstStand) {
      const first = firstStand.gessStand;
      tipoStand = first.tipoStand;
      medidas = first.medidas;
      estado = first.estado;
      bloqueId = first.bloqueId;
      pabellon = first.pabellon;
      ubicacion = first.ubicacion;
      imagenes = first.imagenes ?? [];
      documentosCategorias = normalizarCategorias(first.documentosCategorias);
      standApiId = first.standApiId;
      empresaMontajistaId = first.montajistaId;
      empresaMontajistaNombre = first.montajistaNombre;
    }
    documentos = row.documentos ?? [];
  }

    const docsList = row.docsAdjuntos.map((d) => ({
      id: d.id,
      url: d.url,
      nombre: d.nombre,
      userId: d.userId,
      uploadedBy: d.uploadedBy,
      categoria: d.categoria,
      requisito: d.requisito,
      origen: d.origen,
      estado: d.estado,
      motivoObservacion: d.motivoObservacion,
      observadoPor: d.observadoPor,
      observadoAt: d.observadoAt,
      createdAt: d.createdAt,
    }));

    // Empresa vinculada y nombre del usuario solicitante (user_role)
    const solicitudUserId = row.userId;
    let nombreUsuario: string | null = null;
    if (solicitudUserId) {
      const userRole = await prisma.userRole.findFirst({
        where: { userId: solicitudUserId },
        select: { nombreEmpresa: true, nombre: true, apellidos: true },
      });
      if (!empresa && userRole?.nombreEmpresa) empresa = userRole.nombreEmpresa;
      nombreUsuario = nombreCompleto(userRole?.nombre, userRole?.apellidos);
    }

    /*
     * Cuentas provisionales (`acceso-<ruc>@acceso.iimp`): si el usuario ya no existe
     * en user_role o el stand no trae empresa, se resuelve la ficha por el documento
     * embebido en el correo (razon social y representante legal).
     */
    if (!empresa || !nombreUsuario) {
      const documento = documentoDesdeEmailProvisional(row.email);
      if (documento) {
        const empresaProvisional = await prisma.empresa.findFirst({
          where: { ruc: documento },
          select: { razonSocial: true, representanteLegalNombre: true },
        });
        if (!empresa && empresaProvisional?.razonSocial) empresa = empresaProvisional.razonSocial;
        if (!nombreUsuario) nombreUsuario = empresaProvisional?.representanteLegalNombre ?? null;
      }
    }

    return {
    id: solicitudId,
    gessStandId,
    standCode,
    standCodes,
    standsDetalle,
    tipoStand,
    medidas,
    empresa,
    email: row.email,
    userId: row.userId,
    nombreUsuario,
    standApiId,
    bloqueId,
    pabellon,
    ubicacion,
    precio,
    documentosCategorias,
    empresaMontajistaId,
    empresaMontajistaNombre,
    estado,
    recortePlanoUrl: row.recortePlanoUrl ?? null,
    planCuotas: (row.planCuotas ?? null) as PlanCuotasSolicitud | null,
    iimpContrato: row.iimpContrato ?? null,
    iimpCuentaCorriente: row.iimpCuentaCorriente ?? null,
    iimpClienteCodigo: row.iimpClienteCodigo ?? null,
    iimpReserva: (row.iimpReserva ?? null) as unknown,
    iimpReservaAt: row.iimpReservaAt ?? null,
    estadoSolicitud: row.estado || computeEstadoSolicitud(revisiones),
    flgActivo: row.flgActivo,
    contratoHabilitado: row.contratoHabilitado,
    documentos,
    imagenes,
    docsAdjuntosCount: row._count.docsAdjuntos,
    clienteDocsAdjuntosCount: docsList.filter((d) => d.userId === row.userId).length,
    docsAdminCount: docsList.filter((d) => d.userId === null).length,
    docsAdjuntos: docsList,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
    revisiones,
    reevaluaciones,
    revisionAsociado: revisiones.find((r) => r.area === REVISION_AREAS.ASOCIADO) ?? null,
    revisionLegal: revisiones.find((r) => r.area === REVISION_AREAS.LEGAL) ?? null,
    tieneFacturacion: row.facturaciones.length > 0,
    tipoFacturacion: row.facturaciones[0]?.tipo ?? null,
    facturacionId: row.facturaciones[0]?.id ?? null,
    sgcEstadoEnvio: row.sgcExpediente?.estadoEnvio ?? null,
    sgcLifecycleStatus: row.sgcExpediente?.lifecycleStatus ?? null,
    sgcStage: row.sgcExpediente?.stage ?? null,
    sgcSubsanacionMotivo: row.sgcExpediente?.subsanacionMotivo ?? null,
    sgcSubsanacionModo: row.sgcExpediente?.subsanacionModo ?? null,
    sgcDocumentosEnviados: (row.sgcExpediente?._count?.documentos ?? 0) > 0,
    sgcEnabled: isSgcEnabled(),
  };
}

/** Inicio/fin del dia en hora de Peru (UTC-5, sin horario de verano). */
function inicioDiaLima(fecha: string): Date {
  return dateUtils.toDate(`${fecha}T00:00:00.000-05:00`) ?? dateUtils.now();
}

function finDiaLima(fecha: string): Date {
  return dateUtils.toDate(`${fecha}T23:59:59.999-05:00`) ?? dateUtils.now();
}

export class SolicitudesPrismaRepository implements ISolicitudesRepository {
  async listar(params: SolicitudesListParams): Promise<SolicitudesPaginatedResult> {
    /* Excluye las bajas logicas (`flgActivo = false`) en TODOS los listados. */
    const and: Record<string, unknown>[] = [{ flgActivo: true }];
    if (params.eventoId) {
      and.push({
        OR: [
          { gessStand: { eventoId: params.eventoId } },
          { stands: { some: { gessStand: { eventoId: params.eventoId } } } },
        ],
      });
    }
    if (params.userId) {
      and.push({ userId: params.userId });
    }
    if (params.empresaId) {
      /* "Ver como": incluye a todos los usuarios vinculados a la empresa. */
      const { userIds, emails } = await usuariosDeEmpresa(params.empresaId);
      and.push(
        userIds.length > 0 || emails.length > 0
          ? {
              OR: [
                ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
                ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
              ],
            }
          : { id: "__sin_empresa__" },
      );
    }
    if (params.search) {
      const q = params.search;
      /* La empresa/usuario puede venir de user_role (fallback cuando el stand no la trae). */
      const usuarios = await prisma.userRole.findMany({
        where: {
          OR: [
            { nombreEmpresa: { contains: q, mode: "insensitive" } },
            { nombre: { contains: q, mode: "insensitive" } },
            { apellidos: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { userId: true },
        take: 500,
      });
      const userIds = usuarios.map((u) => u.userId);
      and.push({
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { iimpContrato: { contains: q, mode: "insensitive" } },
          { iimpClienteCodigo: { contains: q, mode: "insensitive" } },
          ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
          { gessStand: { is: { OR: [{ empresa: { contains: q, mode: "insensitive" } }, { standCode: { contains: q, mode: "insensitive" } }] } } },
          { stands: { some: { gessStand: { OR: [{ empresa: { contains: q, mode: "insensitive" } }, { standCode: { contains: q, mode: "insensitive" } }] } } } },
        ],
      });
    }
    if (params.empresa) {
      const q = params.empresa;
      const usuarios = await prisma.userRole.findMany({
        where: { nombreEmpresa: { contains: q, mode: "insensitive" } },
        select: { userId: true },
        take: 500,
      });
      const userIds = usuarios.map((u) => u.userId);
      and.push({
        OR: [
          ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
          { gessStand: { is: { empresa: { contains: q, mode: "insensitive" } } } },
          { stands: { some: { gessStand: { empresa: { contains: q, mode: "insensitive" } } } } },
        ],
      });
    }
    if (params.standCode) {
      const q = params.standCode;
      and.push({
        OR: [
          { gessStand: { is: { standCode: { contains: q, mode: "insensitive" } } } },
          { stands: { some: { gessStand: { standCode: { contains: q, mode: "insensitive" } } } } },
        ],
      });
    }
    if (params.areaPendiente) {
      and.push({ revisiones: { some: { area: params.areaPendiente, estado: ESTADOS_REVISION.PENDIENTE } } });
    }
    if (params.docsObservados) {
      and.push({ docsAdjuntos: { some: { flgActivo: true, estado: ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO } } });
    }
    if (params.sgc === SOLICITUDES_FILTRO_SGC.CON) {
      and.push({ sgcExpediente: { isNot: null } });
    } else if (params.sgc === SOLICITUDES_FILTRO_SGC.SIN) {
      and.push({ sgcExpediente: { is: null } });
    } else if (params.sgc === SOLICITUDES_FILTRO_SGC.OBSERVADO) {
      and.push({ sgcExpediente: { is: { lifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED } } });
    } else if (params.sgc === SOLICITUDES_FILTRO_SGC.RECHAZADO) {
      and.push({ sgcExpediente: { is: { lifecycleStatus: SGC_LIFECYCLE_STATUSES.REJECTED } } });
    }
    if (params.desde || params.hasta) {
      and.push({
        createdAt: {
          ...(params.desde ? { gte: inicioDiaLima(params.desde) } : {}),
          ...(params.hasta ? { lte: finDiaLima(params.hasta) } : {}),
        },
      });
    }
    const where = { AND: and };
    const orderBy = { updatedAt: params.orden === "antiguos" ? ("asc" as const) : ("desc" as const) };
    const skip = (params.page - 1) * params.perPage;
    const include = {
      gessStand: true,
      revisiones: true,
      reevaluaciones: { orderBy: { createdAt: "desc" as const } },
      docsAdjuntos: { where: { flgActivo: true } },
      facturaciones: { where: { flgActivo: true } },
      sgcExpediente: { include: { _count: { select: { documentos: true } } } },
      _count: { select: { docsAdjuntos: { where: { flgActivo: true } } } },
    } satisfies Prisma.SolicitudInclude;

    /*
     * El estado es calculado (revisiones), no una columna: si se filtra por estado se
     * resuelven primero los IDs que cumplen y luego se hidrata solo la pagina pedida.
     */
    if (params.estado) {
      const lite = await prisma.solicitud.findMany({
        where: where as never,
        select: { id: true, estado: true, revisiones: { select: { area: true, estado: true } } },
        orderBy,
      });
      const ids = lite
        .filter((r) => (r.estado || computeEstadoSolicitud(r.revisiones as unknown as RevisionEntity[])) === params.estado)
        .map((r) => r.id);
      const total = ids.length;
      const pageIds = ids.slice(skip, skip + params.perPage);
      const rows = pageIds.length
        ? await prisma.solicitud.findMany({ where: { id: { in: pageIds } }, include })
        : [];
      const rowsById = new Map(rows.map((r) => [r.id, r]));
      const data = await Promise.all(
        pageIds.map((id) => rowsById.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r)).map((r) => mapRow(r)),
      );
      return {
        data,
        total,
        page: params.page,
        perPage: params.perPage,
        totalPages: Math.ceil(total / params.perPage),
      };
    }

    const [total, rows] = await Promise.all([
      prisma.solicitud.count({ where: where as never }),
      prisma.solicitud.findMany({
        where: where as never,
        include,
        orderBy,
        skip,
        take: params.perPage,
      }),
    ]);

    const data = await Promise.all(rows.map((r) => mapRow(r)));

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
        facturaciones: true,
        sgcExpediente: { include: { _count: { select: { documentos: true } } } },
        _count: { select: { docsAdjuntos: { where: { flgActivo: true } } } },
      },
    });
    if (!row) return null;
    return mapRow(row);
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
      const result = mapRevision(updated);
      result.fuePrimeraRevision = existing.estado === RESULTADOS_APROBACION.PENDIENTE;
      return result;
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
    const result = mapRevision(created);
    result.fuePrimeraRevision = true;
    return result;
  }

  async touchAuditoria(solicitudId: string, actor: string | null, ip: string | null): Promise<void> {
    await prisma.solicitud.update({
      where: { id: solicitudId },
      data: { updatedBy: actor, updatedIp: ip },
    });
  }

  async crearRevisionInicial(solicitudId: string, area: string): Promise<RevisionEntity> {
    const created = await prisma.revision.create({
      data: { solicitudId, area, estado: ESTADOS_REVISION.PENDIENTE },
    });
    const result = mapRevision(created);
    result.fuePrimeraRevision = false;
    return result;
  }

  async crearSolicitud(
    standIds: string[],
    userId?: string,
    email?: string,
    datosFacturacion?: DatosFacturacionSolicitud | null,
    auditoria?: { actor?: string | null; ip?: string | null },
  ): Promise<string> {
    const created = await prisma.solicitud.create({
      data: {
        gessStandId: standIds.length === 1 ? standIds[0] : null,
        userId: userId ?? null,
        email: email ?? null,
        datosFacturacion: (datosFacturacion ?? undefined) as never,
        createdBy: auditoria?.actor ?? null,
        updatedBy: auditoria?.actor ?? null,
        createdIp: auditoria?.ip ?? null,
        updatedIp: auditoria?.ip ?? null,
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

  async crearAlertaReserva(data: { userId: string; tipo: string; clave: string; datos: unknown; url?: string }): Promise<void> {
    const { titulo, mensaje } = getAlertaPlantilla(data.clave as never, IDIOMAS.ES, data.datos as never) ?? { titulo: "", mensaje: "" };
    await prisma.alerta.create({
      data: { userId: data.userId, tipo: data.tipo, titulo, mensaje, clave: data.clave, datos: data.datos as never, url: data.url },
    });
  }

  async crearReevaluacion(solicitudId: string, estado: string, motivo: string | null, documentos: unknown, createdBy: string): Promise<ReevaluacionEntity> {
    const created = await prisma.reevaluacion.create({
      data: { solicitudId, estado, motivo, documentos: documentos ?? [], createdBy, updatedBy: createdBy },
    });
    return { id: created.id, solicitudId: created.solicitudId, estado: created.estado, motivo: created.motivo, documentos: created.documentos, createdBy: created.createdBy, updatedBy: created.updatedBy, createdAt: created.createdAt, updatedAt: created.updatedAt };
  }

  async tieneReevaluacionPendiente(solicitudId: string): Promise<boolean> {
    const exist = await prisma.reevaluacion.findFirst({ where: { solicitudId, estado: ESTADOS_REEVALUACION.PENDIENTE } });
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
      await prisma.revision.update({ where: { id: rev.id }, data: { estado: ESTADOS_REVISION.PENDIENTE, comentario: null, updatedBy: reviewerEmail } });
    }
    await prisma.reevaluacion.update({ where: { id: reevaluacionId }, data: { estado: ESTADOS_REEVALUACION.APROBADO, updatedBy: reviewerEmail } });

    if (reevaluacion.documentos && Array.isArray(reevaluacion.documentos) && reevaluacion.documentos.length > 0) {
      await prisma.solicitud.update({ where: { id: reevaluacion.solicitudId }, data: { documentos: reevaluacion.documentos as never } });
    }
  }

  async atenderReevaluacionRechazo(reevaluacionId: string, reviewerEmail: string): Promise<void> {
    const reevaluacion = await prisma.reevaluacion.findUnique({ where: { id: reevaluacionId } });
    if (!reevaluacion) throw new Error("NOT_FOUND");

    await prisma.reevaluacion.update({ where: { id: reevaluacionId }, data: { estado: ESTADOS_REEVALUACION.RECHAZADO, updatedBy: reviewerEmail } });

    const solicitud = await prisma.solicitud.findUnique({ where: { id: reevaluacion.solicitudId }, select: { gessStandId: true } });
    if (solicitud?.gessStandId) {
      await this.liberarStandGess(solicitud.gessStandId);
    } else {
      const stands = await prisma.solicitudStand.findMany({ where: { solicitudId: reevaluacion.solicitudId }, select: { gessStandId: true } });
      for (const s of stands) {
        await this.liberarStandGess(s.gessStandId);
      }
    }
    await prisma.revision.deleteMany({ where: { solicitudId: reevaluacion.solicitudId } });
  }

  async darDeBajaSolicitud(solicitudId: string): Promise<void> {
    const solicitud = await prisma.solicitud.findUnique({ where: { id: solicitudId }, select: { gessStandId: true, flgActivo: true } });
    if (!solicitud || !solicitud.flgActivo) throw new Error("NOT_FOUND");

    await prisma.solicitud.update({ where: { id: solicitudId }, data: { flgActivo: false } });

    if (solicitud.gessStandId) {
      await this.liberarStandGess(solicitud.gessStandId);
    } else {
      const stands = await prisma.solicitudStand.findMany({ where: { solicitudId }, select: { gessStandId: true } });
      for (const s of stands) {
        await this.liberarStandGess(s.gessStandId);
      }
    }
  }

  /**
   * Devuelve un stand liberado a su estado correcto segun jerarquia: si conserva
   * snapshot de pre-reserva vuelve a `pre_reservado` (la pre-reserva revive al
   * caerse la solicitud); si no, a `disponible` como siempre.
   */
  private async liberarStandGess(gessStandId: string): Promise<void> {
    const stand = await prisma.gessStand.findUnique({
      where: { id: gessStandId },
      select: { preReservaAt: true, preReservaRazonSocial: true, preReservaTitulo: true },
    });
    const conPreReserva = Boolean(stand && (stand.preReservaAt || stand.preReservaRazonSocial || stand.preReservaTitulo));
    await prisma.gessStand.update({
      where: { id: gessStandId },
      data: { estado: conPreReserva ? ESTADOS_STAND.PRE_RESERVADO : ESTADOS_STAND.DISPONIBLE },
    });
  }

  async marcarOrdenPago(solicitudId: string): Promise<void> {
    await prisma.solicitud.update({ where: { id: solicitudId }, data: { estado: ESTADOS_SOLICITUD.PENDIENTE_PAGO } });

    const sol = await prisma.solicitud.findUnique({ where: { id: solicitudId }, select: { gessStandId: true, planCuotas: true } });
    const stands = sol?.gessStandId
      ? await prisma.gessStand.findMany({ where: { id: sol.gessStandId } })
      : await prisma.solicitudStand.findMany({ where: { solicitudId }, include: { gessStand: true } }).then(r => r.map(s => s.gessStand));
    /*
     * RF-10: el plan de pagos lo definio el cliente en el contrato (`solicitud.plan_cuotas`)
     * y es la fuente de verdad de Facturacion. Sus montos YA incluyen IGV: el total a facturar
     * debe ser la SUMA DE CUOTAS (el precio base del stand es neto). Sin plan (legacy/manual)
     * se mantiene el comportamiento anterior (precio base del stand).
     */
    const plan = sol?.planCuotas as
      | { modalidad?: string; cuotas?: Array<{ numero: number; monto: number; fechaVencimiento: string | null }> }
      | null;
    const cuotasPlan = plan?.cuotas ?? [];
    const montoTotal = cuotasPlan.length > 0
      ? sumarMontos(cuotasPlan)
      : stands.reduce((sum, s) => sum + resolverPrecioStand(s), 0);

    const existing = await prisma.facturacion.findFirst({ where: { solicitudId, flgActivo: true } });
    const facturacion = existing
      ? await prisma.facturacion.update({ where: { id: existing.id }, data: { montoTotal } })
      : await prisma.facturacion.create({
          data: { solicitudId, tipo: TIPOS_FACTURACION.MANUAL, montoTotal, moneda: MONEDAS.US_DOLAR },
        });

    /*
     * Las cuotas ya pagadas no se tocan; las pendientes se alinean al plan.
     */
    if (cuotasPlan.length > 0) {
      const modoPago = plan?.modalidad === MODOS_PAGO.COMPLETO ? "completo" : "cuotas";
      await prisma.facturacion.update({ where: { id: facturacion.id }, data: { modoPago } });
      for (const cuota of cuotasPlan) {
        const fecha = cuota.fechaVencimiento ? dateUtils.toDate(cuota.fechaVencimiento) : null;
        const existente = await prisma.facturacionCuota.findFirst({
          where: { facturacionId: facturacion.id, numero: cuota.numero },
        });
        if (existente) {
          if (existente.estado === ESTADOS_CUOTA.PENDIENTE) {
            await prisma.facturacionCuota.update({
              where: { id: existente.id },
              data: { monto: cuota.monto, fechaVencimiento: fecha },
            });
          }
        } else {
          await prisma.facturacionCuota.create({
            data: { facturacionId: facturacion.id, numero: cuota.numero, monto: cuota.monto, fechaVencimiento: fecha },
          });
        }
      }
    }
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
        createdAt: r.createdAt ?? dateUtils.now(),
        updatedAt: r.updatedAt ?? dateUtils.now(),
        fuePrimeraRevision: false,
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

  async crearDocumentoAdjunto(solicitudId: string, url: string, nombre: string, userId: string | null, email: string, categoria?: string | null, requisito?: string | null, sha256?: string | null): Promise<Record<string, unknown>> {
    const doc = await prisma.solicitudDocumento.create({
      data: { solicitudId, url, nombre, uploadedBy: email, userId, categoria: categoria ?? null, requisito: requisito ?? null, sha256: sha256 ?? null },
    });
    return { ...doc };
  }

  async findDocumento(docId: string) {
    const doc = await prisma.solicitudDocumento.findUnique({ where: { id: docId }, select: { id: true, userId: true, solicitudId: true, createdAt: true, estado: true, flgActivo: true } });
    return doc ?? null;
  }

  async findDocumentoPorHashEnOtraSolicitud(sha256: string, solicitudId: string) {
    const doc = await prisma.solicitudDocumento.findFirst({
      where: { sha256, flgActivo: true, solicitudId: { not: solicitudId } },
      select: { solicitudId: true },
    });
    return doc ?? null;
  }

  /** Marca documentos como observados (baja logica por estado, con motivo y auditoria). */
  async observarDocumentos(solicitudId: string, docIds: string[], motivo: string, observadoPor: string): Promise<number> {
    const r = await prisma.solicitudDocumento.updateMany({
      where: {
        solicitudId,
        id: { in: docIds },
        flgActivo: true,
        estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
      },
      data: {
        estado: ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO,
        motivoObservacion: motivo,
        observadoPor,
        observadoAt: dateUtils.now(),
      },
    });
    return r.count;
  }

  /** Marca como reemplazados los documentos ACTIVOS del cliente con la misma categoria/requisito. */
  async marcarDocumentosReemplazados(solicitudId: string, userId: string, categoria: string | null, requisito: string | null): Promise<void> {
    await prisma.solicitudDocumento.updateMany({
      where: {
        solicitudId,
        userId,
        flgActivo: true,
        estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
        categoria: categoria ?? null,
        requisito: requisito ?? null,
      },
      data: { estado: ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO },
    });
  }

  /** Marca como reemplazados (historial) los documentos indicados. */
  async marcarDocumentosReemplazadosPorIds(solicitudId: string, docIds: string[]): Promise<void> {
    if (docIds.length === 0) return;
    await prisma.solicitudDocumento.updateMany({
      where: { solicitudId, id: { in: docIds }, flgActivo: true },
      data: { estado: ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO },
    });
  }

  async eliminarDocumento(docId: string) {
    await prisma.solicitudDocumento.update({ where: { id: docId }, data: { flgActivo: false } });
  }

  async crearAlertaRevision(data: { rol: string; solicitudId: string; clave: string; datos: unknown }) {
    const usuarios = await prisma.userRole.findMany({
      where: { role: { nombre: data.rol } },
      select: { userId: true },
    });
    const render = getAlertaPlantilla(data.clave as never, IDIOMAS.ES, data.datos as never) ?? { titulo: "", mensaje: "" };
    for (const u of usuarios) {
      await prisma.alerta.create({
        data: {
          userId: u.userId,
          tipo: "revision_pendiente",
          titulo: render.titulo,
          mensaje: render.mensaje,
          clave: data.clave,
          datos: data.datos as never,
          url: `${getAppUrl()}/dashboard/solicitudes?id=${data.solicitudId}`,
        },
      });
    }
  }

  async crearAlertaRol(data: { rol: string; tipo: string; clave: string; datos: unknown; url: string }) {
    const usuarios = await prisma.userRole.findMany({
      where: { role: { nombre: data.rol } },
      select: { userId: true },
    });
    const render = getAlertaPlantilla(data.clave as never, IDIOMAS.ES, data.datos as never) ?? { titulo: "", mensaje: "" };
    for (const u of usuarios) {
      await prisma.alerta.create({
        data: {
          userId: u.userId,
          tipo: data.tipo,
          titulo: render.titulo,
          mensaje: render.mensaje,
          clave: data.clave,
          datos: data.datos as never,
          url: data.url,
        },
      });
    }
  }

  async findNombreUsuario(userId: string): Promise<string | null> {
    const u = await prisma.userRole.findFirst({
      where: { userId },
      select: { nombre: true, apellidos: true },
    });
    if (!u?.nombre) return null;
    return [u.nombre, u.apellidos].filter(Boolean).join(" ") || u.nombre;
  }

  /** RF-08: persiste la URL de la imagen del recorte del pabellon de la solicitud. */
  async guardarRecortePlano(solicitudId: string, url: string): Promise<void> {
    await prisma.solicitud.update({
      where: { id: solicitudId },
      data: { recortePlanoUrl: url },
    });
  }

  /** Habilita la firma del contrato posterior sin generar ni modificar documentos. */
  async habilitarContrato(solicitudId: string): Promise<void> {
    await prisma.solicitud.update({
      where: { id: solicitudId },
      data: { contratoHabilitado: true },
    });
  }

  /** RF-10/11: snapshot del plan de cuotas configurado por el cliente. */
  async guardarPlanCuotas(solicitudId: string, plan: PlanCuotasSolicitud): Promise<void> {
    await prisma.solicitud.update({
      where: { id: solicitudId },
      data: { planCuotas: plan as never },
    });
  }

  /**
   * RF-11: un unico contrato generado por el sistema por solicitud (idempotente).
   * Si ya existe uno vigente lo actualiza (refrescando `createdAt`: una regeneracion cuenta
   * como correccion posterior al ultimo firmado del cliente); si no, lo crea como
   * `categoria = contrato` con `origen = generado`.
   */
  async upsertContratoSistema(solicitudId: string, url: string, nombre: string): Promise<void> {
    const existente = await prisma.solicitudDocumento.findFirst({
      where: { solicitudId, categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO, uploadedBy: "sistema", flgActivo: true },
      select: { id: true, estado: true },
      orderBy: { createdAt: "desc" },
    });
    if (existente) {
      /*
       * Si el contrato fue observado (o reemplazado), NO se sobrescribe: se conserva
       * como historial (`reemplazado`) y se crea una version nueva activa para que
       * el cliente la firme. Nunca se elimina el contrato anterior.
       */
      if (existente.estado === ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO || existente.estado === ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO) {
        await prisma.solicitudDocumento.update({
          where: { id: existente.id },
          data: { estado: ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO },
        });
        await prisma.solicitudDocumento.create({
          data: {
            solicitudId,
            url,
            nombre,
            uploadedBy: "sistema",
            userId: null,
            categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
            origen: ORIGENES_DOCUMENTO.GENERADO,
          },
        });
        return;
      }
      await prisma.solicitudDocumento.update({
        where: { id: existente.id },
        data: { url, nombre, origen: ORIGENES_DOCUMENTO.GENERADO, createdAt: dateUtils.now() },
      });
      return;
    }
    await prisma.solicitudDocumento.create({
      data: {
        solicitudId,
        url,
        nombre,
        uploadedBy: "sistema",
        userId: null,
        categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
        origen: ORIGENES_DOCUMENTO.GENERADO,
      },
    });
  }

  async guardarReservaIImp(solicitudId: string, data: {
    contrato: string;
    cuentaCorriente: string;
    clienteCodigo: string | null;
    reserva: unknown;
    at: Date;
    requisitos: unknown | null;
  }): Promise<void> {
    await prisma.solicitud.update({
      where: { id: solicitudId },
      data: {
        iimpContrato: data.contrato,
        iimpCuentaCorriente: data.cuentaCorriente,
        iimpClienteCodigo: data.clienteCodigo,
        iimpReserva: data.reserva as never,
        iimpReservaAt: data.at,
        requisitosFacturacion: (data.requisitos ?? null) as never,
      },
    });
  }

  async datosReservaIImp(solicitudId: string) {
    const row = await prisma.solicitud.findUnique({
      where: { id: solicitudId },
      include: {
        gessStand: { select: { eventoId: true, standApiId: true, standCode: true } },
        stands: { include: { gessStand: { select: { eventoId: true, standApiId: true, standCode: true } } } },
      },
    });
    if (!row) return null;
    const gessStands = row.gessStand ? [row.gessStand] : row.stands.map((s) => s.gessStand).filter((s): s is NonNullable<typeof s> => s !== null);
    const eventoId = gessStands[0]?.eventoId ?? null;
    const evento = eventoId ? await prisma.evento.findUnique({ where: { id: eventoId }, select: { tipoEvento: true, codigoEvento: true } }) : null;
    return {
      iimpContrato: row.iimpContrato ?? null,
      iimpCuentaCorriente: row.iimpCuentaCorriente ?? null,
      email: row.email ?? null,
      tipoEvento: evento?.tipoEvento ?? null,
      codigoEvento: evento?.codigoEvento ?? null,
      stands: gessStands.map((s) => s.standApiId ?? s.standCode).filter(Boolean),
      planCuotas: (row.planCuotas ?? null) as PlanCuotasSolicitud | null,
      datosFacturacion: (row.datosFacturacion ?? null) as DatosFacturacionSolicitud | null,
      requisitosFacturacion: (row.requisitosFacturacion ?? null) as unknown,
    };
  }

  /** Id de la solicitud ACTIVA cuyo `NumeroSolicitud` del IIMP coincide (el numero es determinista del id). */
  async findSolicitudIdPorNumeroIImp(numeroSolicitud: string): Promise<string | null> {
    const limpio = numeroSolicitud.trim();
    if (!limpio) return null;
    const resto = limpio.startsWith(IIMP_NUMERO_SOLICITUD_PREFIJO) ? limpio.slice(IIMP_NUMERO_SOLICITUD_PREFIJO.length) : limpio;
    if (!resto) return null;
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM solicitud WHERE flg_activo = true AND replace(id, '-', '') LIKE ${resto + "%"} LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }

  /** Id de la solicitud ACTIVA registrada en el IIMP con ese contrato. */
  async findSolicitudIdPorContrato(contrato: string): Promise<string | null> {
    const limpio = contrato.trim();
    if (!limpio) return null;
    const row = await prisma.solicitud.findFirst({ where: { iimpContrato: limpio, flgActivo: true }, select: { id: true } });
    return row?.id ?? null;
  }
}
