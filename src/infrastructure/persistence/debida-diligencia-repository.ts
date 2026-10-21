import "server-only";

import { prisma } from "@/lib/server/db";
import type { Prisma } from "@prisma/client";
import type {
  DdBandejaParams,
  DdBandejaResult,
  DdBandejaRow,
  DdClientesParams,
  DdClientesRawResult,
  DdDocumentoEntity,
  DdEmpresaEstadoEntity,
  DdEmpresaEstadoImportData,
  DdEmpresasParams,
  DdEmpresasRawResult,
  DdEmpresaResumen,
  DdExpedienteEntity,
  DdGuardarData,
  DdMatrizParams,
  DdMatrizResult,
  DdMatrizRow,
  DdObservacionCreacion,
  DdObservacionEntity,
  DdPanelKpis,
  DdPanelVinculo,
  DdReputacionActualizacion,
  DdReputacionCasoEntity,
  DdReputacionCreacion,
  DdReputacionParams,
  DdReputacionResult,
} from "@/domain/models/debida-diligencia";
import type {
  DdEstadoExpedienteData,
  IDebidaDiligenciaRepository,
} from "@/domain/ports/debida-diligencia-repository";
import {
  DD_CODIGO_DIGITOS,
  DD_CODIGO_PREFIJO,
  DD_DIAS_POR_VENCER,
  DD_DOCUMENTOS_FILTRO,
  DD_SOLICITUDES_FILTRO,
  DD_BANDEJA_ORDEN,
  DD_ASIGNACION_FILTRO,
  DD_FILTRO_POR_VENCER,
  DD_FILTRO_SIN_INICIAR,
  DD_FILTRO_TODAS,
  DD_IMPORTACION_REVISOR,
  DD_REPUTACION_FILTRO_PENDIENTE,
  DD_DOCUMENTO_ESTADOS,
  DD_DOCUMENTOS_REQUERIDOS,
  DD_ESTADOS,
  DD_ESTADOS_EVALUACION,
  DD_OBSERVACION_ESTADOS,
  DD_REPUTACION_ESTADOS,
  DD_RESULTADOS,
  DD_VINCULOS,
  DD_VINCULO_LABELS,
  ESTADOS_EMPRESA,
  type DdDocumentoTipo,
  type DdEstado,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { normalizarDocumentoEmpresa } from "@/lib/shared/utils/documento-empresa";

const empresaSelect = {
  id: true,
  ruc: true,
  tipoDocumento: true,
  razonSocial: true,
  nombreComercial: true,
  sitioWeb: true,
  emailContacto: true,
  representanteLegalNombre: true,
  representanteLegalDni: true,
  representanteCorreo: true,
  logoUrl: true,
} satisfies Prisma.EmpresaSelect;

const eventoSelect = {
  id: true,
  anio: true,
  eventoPadre: { select: { nombre: true } },
} satisfies Prisma.EventoSelect;

const expedienteInclude = {
  empresa: { select: empresaSelect },
  evento: { select: eventoSelect },
  beneficiarios: { orderBy: { orden: "asc" } },
  documentos: {
    orderBy: { createdAt: "asc" },
    include: { versiones: { orderBy: { version: "asc" } } },
  },
  observaciones: { orderBy: { createdAt: "asc" } },
  reputacion: { orderBy: { fechaDerivacion: "asc" } },
} satisfies Prisma.DebidaDiligenciaInclude;

type ExpedienteRow = Prisma.DebidaDiligenciaGetPayload<{ include: typeof expedienteInclude }>;

const reputacionInclude = {
  expediente: {
    select: {
      codigo: true,
      empresa: { select: empresaSelect },
      observaciones: { where: { estado: DD_OBSERVACION_ESTADOS.ABIERTA } },
    },
  },
} satisfies Prisma.DebidaDiligenciaReputacionInclude;

type ReputacionRow = Prisma.DebidaDiligenciaReputacionGetPayload<{ include: typeof reputacionInclude }>;

function mapEmpresa(row: ExpedienteRow["empresa"]): DdEmpresaResumen {
  return {
    id: row.id,
    ruc: row.ruc,
    tipoDocumento: row.tipoDocumento,
    razonSocial: row.razonSocial,
    nombreComercial: row.nombreComercial ?? null,
    sitioWeb: row.sitioWeb ?? null,
    emailContacto: row.emailContacto ?? null,
    representanteLegalNombre: row.representanteLegalNombre ?? null,
    representanteLegalDni: row.representanteLegalDni ?? null,
    representanteCorreo: row.representanteCorreo ?? null,
    logoUrl: row.logoUrl ?? null,
  };
}

function mapExpediente(row: ExpedienteRow): DdExpedienteEntity {
  return {
    id: row.id,
    empresaId: row.empresaId,
    eventoId: row.eventoId,
    codigo: row.codigo,
    estado: row.estado as DdEstado,
    origen: row.origen,
    estadoOrigen: row.estadoOrigen ?? null,
    eventoProyecto: row.eventoProyecto ?? null,
    motivoImportacion: row.motivoImportacion ?? null,
    importacionId: row.importacionId ?? null,
    tipoRelacionComercial: row.tipoRelacionComercial as DdExpedienteEntity["tipoRelacionComercial"],
    actividadEconomica: row.actividadEconomica ?? null,
    actividadEconomicaOtro: row.actividadEconomicaOtro ?? null,
    paisConstitucion: row.paisConstitucion ?? null,
    sitioWeb: row.sitioWeb ?? null,
    emailRepresentante: row.emailRepresentante ?? null,
    aceptaDatos: row.aceptaDatos,
    aceptaVerificacion: row.aceptaVerificacion,
    declaraVerdad: row.declaraVerdad,
    representanteNombre: row.representanteNombre ?? null,
    representanteTipoDocumento: row.representanteTipoDocumento ?? null,
    representanteDocumento: row.representanteDocumento ?? null,
    representanteNacionalidad: row.representanteNacionalidad ?? null,
    fechaEnvio: row.fechaEnvio ?? null,
    fechaRevision: row.fechaRevision ?? null,
    fechaAprobacion: row.fechaAprobacion ?? null,
    fechaVencimiento: row.fechaVencimiento ?? null,
    fechaRechazo: row.fechaRechazo ?? null,
    revisadoPor: row.revisadoPor ?? null,
    motivoRechazo: row.motivoRechazo ?? null,
    fechaDerivacionLegal: row.fechaDerivacionLegal ?? null,
    derivadoLegalPor: row.derivadoLegalPor ?? null,
    fechaLegal: row.fechaLegal ?? null,
    legalRevisor: row.legalRevisor ?? null,
    decisionLegal: row.decisionLegal as DdExpedienteEntity["decisionLegal"],
    motivoLegal: row.motivoLegal ?? null,
    informeLegalNombre: row.informeLegalNombre ?? null,
    informeLegalUrl: row.informeLegalUrl ?? null,
    creadoPor: row.creadoPor,
    actualizadoPor: row.actualizadoPor ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    empresa: mapEmpresa(row.empresa),
    evento: {
      id: row.evento.id,
      nombre: `${row.evento.eventoPadre.nombre} ${row.evento.anio}`.trim(),
      anio: row.evento.anio,
    },
    beneficiarios: row.beneficiarios.map((b) => ({
      id: b.id,
      orden: b.orden,
      nombre: b.nombre,
      documento: b.documento,
      nacionalidad: b.nacionalidad,
      porcentaje: Number(b.porcentaje),
    })),
    documentos: row.documentos.map((d) => ({
      id: d.id,
      tipo: d.tipo as DdDocumentoEntity["tipo"],
      nombre: d.nombre,
      url: d.url,
      estado: d.estado as DdDocumentoEntity["estado"],
      observacion: d.observacion ?? null,
      updatedAt: d.updatedAt,
      versiones: d.versiones.map((v) => ({
        id: v.id,
        version: v.version,
        nombre: v.nombre,
        url: v.url,
        creadoPor: v.creadoPor ?? null,
        createdAt: v.createdAt,
      })),
    })),
    observaciones: row.observaciones.map((o) => ({
      id: o.id,
      area: o.area as DdObservacionEntity["area"],
      documentoTipo: o.documentoTipo as DdObservacionEntity["documentoTipo"],
      texto: o.texto,
      estado: o.estado,
      creadoPor: o.creadoPor,
      fechaResolucion: o.fechaResolucion ?? null,
      createdAt: o.createdAt,
    })),
    reputacion: row.reputacion.map((r) => ({
      id: r.id,
      nombreARevisar: r.nombreARevisar,
      sitioWeb: r.sitioWeb ?? null,
      estado: r.estado as DdReputacionCasoEntity["estado"],
      resultado: r.resultado as DdReputacionCasoEntity["resultado"],
      comentario: r.comentario ?? null,
      derivadoPor: r.derivadoPor,
      fechaDerivacion: r.fechaDerivacion,
      revisor: r.revisor ?? null,
      fechaCierre: r.fechaCierre ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  };
}

function mapReputacion(row: ReputacionRow): DdReputacionResult["data"][number] {
  return {
    id: row.id,
    expedienteId: row.expedienteId,
    codigo: row.expediente.codigo,
    empresa: mapEmpresa(row.expediente.empresa),
    nombreARevisar: row.nombreARevisar,
    sitioWeb: row.sitioWeb ?? null,
    estado: row.estado as DdReputacionResult["data"][number]["estado"],
    resultado: row.resultado as DdReputacionResult["data"][number]["resultado"],
    comentario: row.comentario ?? null,
    derivadoPor: row.derivadoPor,
    fechaDerivacion: row.fechaDerivacion,
    revisor: row.revisor ?? null,
    fechaCierre: row.fechaCierre ?? null,
    observacionesAbiertas: row.expediente.observaciones.length,
  };
}

export class DebidaDiligenciaPrismaRepository implements IDebidaDiligenciaRepository {
  async findExpedientePorEmpresaEvento(empresaId: string, eventoId: string): Promise<DdExpedienteEntity | null> {
    const row = await prisma.debidaDiligencia.findUnique({
      where: { empresaId_eventoId: { empresaId, eventoId } },
      include: expedienteInclude,
    });
    return row ? mapExpediente(row) : null;
  }

  async findExpedientePorId(id: string): Promise<DdExpedienteEntity | null> {
    const row = await prisma.debidaDiligencia.findUnique({ where: { id }, include: expedienteInclude });
    return row ? mapExpediente(row) : null;
  }

  async findEmpresaResumen(empresaId: string): Promise<DdEmpresaResumen | null> {
    const row = await prisma.empresa.findUnique({ where: { id: empresaId }, select: empresaSelect });
    return row ? mapEmpresa(row) : null;
  }

  async findEmpresaIdPorRazonSocial(razonSocial: string): Promise<string | null> {
    const row = await prisma.empresa.findFirst({
      where: { razonSocial: { equals: razonSocial.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async findEmpresaEstado(
    documento: string | null,
    razonSocial: string | null,
  ): Promise<DdEmpresaEstadoEntity | null> {
    const or: Prisma.DebidaDiligenciaEmpresaEstadoWhereInput[] = [];
    const doc = documento?.trim();
    if (doc) {
      or.push({ documento: { equals: doc, mode: "insensitive" } });
      const normalizado = doc.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      if (normalizado && normalizado !== doc.toUpperCase()) {
        or.push({ documento: { equals: normalizado, mode: "insensitive" } });
      }
    }
    if (razonSocial?.trim()) {
      or.push({ razonSocial: { equals: razonSocial.trim(), mode: "insensitive" } });
    }
    if (or.length === 0) return null;

    const row = await prisma.debidaDiligenciaEmpresaEstado.findFirst({
      where: { OR: or },
      orderBy: { updatedAt: "desc" },
    });
    return row as unknown as DdEmpresaEstadoEntity | null;
  }

  async siguienteCodigo(anio: string): Promise<string> {
    const prefijo = `${DD_CODIGO_PREFIJO}-${anio}-`;
    const ultimo = await prisma.debidaDiligencia.findFirst({
      where: { codigo: { startsWith: prefijo } },
      orderBy: { codigo: "desc" },
      select: { codigo: true },
    });
    const consecutivo = ultimo ? Number(ultimo.codigo.slice(prefijo.length)) || 0 : 0;
    return `${prefijo}${String(consecutivo + 1).padStart(DD_CODIGO_DIGITOS, "0")}`;
  }

  async crearExpediente(data: {
    empresaId: string;
    eventoId: string;
    codigo: string;
    creadoPor: string;
  }): Promise<DdExpedienteEntity> {
    const row = await prisma.debidaDiligencia.create({
      data: {
        empresaId: data.empresaId,
        eventoId: data.eventoId,
        codigo: data.codigo,
        estado: DD_ESTADOS.BORRADOR,
        creadoPor: data.creadoPor,
      },
      include: expedienteInclude,
    });
    return mapExpediente(row);
  }

  /** Crea/actualiza un expediente proveniente de la migracion manual. */
  async importarExpediente(data: {
    empresaId: string;
    eventoId: string;
    codigo: string;
    estado: string;
    estadoOrigen: string | null;
    eventoProyecto: string | null;
    motivoImportacion: string | null;
    importacionId: string;
    creadoPor: string;
    actualizadoPor: string;
    fechaEnvio: Date | null;
    fechaRevision: Date | null;
    fechaAprobacion: Date | null;
    fechaVencimiento: Date | null;
    fechaRechazo: Date | null;
  }): Promise<{ id: string; creado: boolean }> {
    const existente = await prisma.debidaDiligencia.findUnique({
      where: { empresaId_eventoId: { empresaId: data.empresaId, eventoId: data.eventoId } },
      select: { id: true },
    });
    if (existente) {
      await prisma.debidaDiligencia.update({
        where: { id: existente.id },
        data: {
          estado: data.estado,
          origen: "importado",
          estadoOrigen: data.estadoOrigen,
          eventoProyecto: data.eventoProyecto,
          motivoImportacion: data.motivoImportacion,
          importacionId: data.importacionId,
          fechaEnvio: data.fechaEnvio,
          fechaRevision: data.fechaRevision,
          fechaAprobacion: data.fechaAprobacion,
          fechaVencimiento: data.fechaVencimiento,
          fechaRechazo: data.fechaRechazo,
          revisadoPor: DD_IMPORTACION_REVISOR,
          actualizadoPor: data.actualizadoPor,
        },
      });
      return { id: existente.id, creado: false };
    }

    const row = await prisma.debidaDiligencia.create({
      data: {
        empresaId: data.empresaId,
        eventoId: data.eventoId,
        codigo: data.codigo,
        estado: data.estado,
        origen: "importado",
        estadoOrigen: data.estadoOrigen,
        eventoProyecto: data.eventoProyecto,
        motivoImportacion: data.motivoImportacion,
        importacionId: data.importacionId,
        creadoPor: data.creadoPor,
        actualizadoPor: data.actualizadoPor,
        fechaEnvio: data.fechaEnvio,
        fechaRevision: data.fechaRevision,
        fechaAprobacion: data.fechaAprobacion,
        fechaVencimiento: data.fechaVencimiento,
        fechaRechazo: data.fechaRechazo,
        revisadoPor: DD_IMPORTACION_REVISOR,
      },
      select: { id: true },
    });
    return { id: row.id, creado: true };
  }

  async crearImportacion(data: {
    archivo: string;
    hash: string;
    eventoId: string;
    usuario: string;
    total: number;
    omitidos: number;
    errores: unknown;
  }): Promise<string> {
    const row = await prisma.ddImportacion.create({
      data: {
        archivo: data.archivo,
        hash: data.hash,
        eventoId: data.eventoId,
        usuario: data.usuario,
        total: data.total,
        omitidos: data.omitidos,
        errores: data.errores as never,
      },
      select: { id: true },
    });
    return row.id;
  }

  async cerrarImportacion(id: string, importados: number, actualizados: number, omitidos: number): Promise<void> {
    await prisma.ddImportacion.update({
      where: { id },
      data: { importados, actualizados, omitidos },
    });
  }

  async guardarFormulario(id: string, data: DdGuardarData, actualizadoPor: string): Promise<DdExpedienteEntity> {
    const row = await prisma.$transaction(async (tx) => {
      await tx.debidaDiligencia.update({
        where: { id },
        data: {
          tipoRelacionComercial: data.tipoRelacionComercial,
          actividadEconomica: data.actividadEconomica,
          actividadEconomicaOtro: data.actividadEconomicaOtro,
          paisConstitucion: data.paisConstitucion,
          sitioWeb: data.sitioWeb,
          emailRepresentante: data.emailRepresentante,
          aceptaDatos: data.aceptaDatos,
          aceptaVerificacion: data.aceptaVerificacion,
          declaraVerdad: data.declaraVerdad,
          representanteNombre: data.representanteNombre,
          representanteTipoDocumento: data.representanteTipoDocumento,
          representanteDocumento: data.representanteDocumento,
          representanteNacionalidad: data.representanteNacionalidad,
          actualizadoPor,
        },
      });

      await tx.debidaDiligenciaBeneficiario.deleteMany({ where: { expedienteId: id } });
      if (data.beneficiarios.length > 0) {
        await tx.debidaDiligenciaBeneficiario.createMany({
          data: data.beneficiarios.map((b, indice) => ({
            expedienteId: id,
            orden: b.orden ?? indice,
            nombre: b.nombre,
            documento: b.documento,
            nacionalidad: b.nacionalidad,
            porcentaje: b.porcentaje,
          })),
        });
      }

      for (const documento of data.documentos) {
        const where = { expedienteId_tipo: { expedienteId: id, tipo: documento.tipo } };
        const existente = await tx.debidaDiligenciaDocumento.findUnique({
          where,
          select: { id: true, nombre: true, url: true, estado: true },
        });

        /* Si el cliente no cambio el archivo, se conserva su estado y su observacion. */
        if (existente?.url === documento.url) {
          await tx.debidaDiligenciaDocumento.update({
            where,
            data: { nombre: documento.nombre },
          });
          continue;
        }

        let documentoId: string;
        if (existente) {
          await tx.debidaDiligenciaDocumento.update({
            where,
            data: {
              nombre: documento.nombre,
              url: documento.url,
              estado: documento.estado,
              observacion: null,
            },
          });
          documentoId = existente.id;
        } else {
          const creado = await tx.debidaDiligenciaDocumento.create({
            data: {
              expedienteId: id,
              tipo: documento.tipo,
              nombre: documento.nombre,
              url: documento.url,
              estado: documento.estado,
            },
          });
          documentoId = creado.id;
        }

        const historial = await tx.debidaDiligenciaDocumentoVersion.findMany({
          where: { documentoId },
          select: { version: true, url: true },
          orderBy: { version: "desc" },
        });
        let siguienteVersion = (historial[0]?.version ?? 0) + 1;

        if (existente && !historial.some((v) => v.url === existente.url)) {
          await tx.debidaDiligenciaDocumentoVersion.create({
            data: {
              documentoId,
              version: siguienteVersion,
              nombre: existente.nombre,
              url: existente.url,
              creadoPor: actualizadoPor,
            },
          });
          siguienteVersion += 1;
        }

        await tx.debidaDiligenciaDocumentoVersion.create({
          data: {
            documentoId,
            version: siguienteVersion,
            nombre: documento.nombre,
            url: documento.url,
            creadoPor: actualizadoPor,
          },
        });
      }

      return tx.debidaDiligencia.findUniqueOrThrow({ where: { id }, include: expedienteInclude });
    });
    return mapExpediente(row);
  }

  async resolverDocumentos(
    expedienteId: string,
    observados: DdDocumentoTipo[],
    observacion: string | null,
  ): Promise<void> {
    const todos = DD_DOCUMENTOS_REQUERIDOS.map((d) => d.tipo);
    await prisma.debidaDiligenciaDocumento.updateMany({
      where: { expedienteId, tipo: { in: observados } },
      data: { estado: DD_DOCUMENTO_ESTADOS.OBSERVADO, observacion },
    });
    const aprobados = todos.filter((tipo) => !observados.includes(tipo));
    if (aprobados.length > 0) {
      await prisma.debidaDiligenciaDocumento.updateMany({
        where: { expedienteId, tipo: { in: aprobados } },
        data: { estado: DD_DOCUMENTO_ESTADOS.APROBADO, observacion: null },
      });
      /* Al aprobar un documento, sus observaciones anteriores quedan resueltas. */
      await prisma.debidaDiligenciaObservacion.updateMany({
        where: {
          expedienteId,
          documentoTipo: { in: aprobados },
          estado: DD_OBSERVACION_ESTADOS.ABIERTA,
        },
        data: { estado: DD_OBSERVACION_ESTADOS.RESUELTA, fechaResolucion: dateUtils.now() },
      });
    }
  }

  async listarObservaciones(expedienteId: string): Promise<DdObservacionEntity[]> {
    const rows = await prisma.debidaDiligenciaObservacion.findMany({
      where: { expedienteId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((o) => ({
      id: o.id,
      area: o.area as DdObservacionEntity["area"],
      documentoTipo: o.documentoTipo as DdObservacionEntity["documentoTipo"],
      texto: o.texto,
      estado: o.estado,
      creadoPor: o.creadoPor,
      fechaResolucion: o.fechaResolucion ?? null,
      createdAt: o.createdAt,
    }));
  }

  async crearObservaciones(
    expedienteId: string,
    observaciones: DdObservacionCreacion[],
    creadoPor: string,
  ): Promise<void> {
    if (observaciones.length === 0) return;
    await prisma.debidaDiligenciaObservacion.createMany({
      data: observaciones.map((o) => ({
        expedienteId,
        area: o.area,
        documentoTipo: o.documentoTipo,
        texto: o.texto,
        estado: DD_OBSERVACION_ESTADOS.ABIERTA,
        creadoPor,
      })),
    });
  }

  async resolverObservaciones(expedienteId: string): Promise<void> {
    await prisma.debidaDiligenciaObservacion.updateMany({
      where: { expedienteId, estado: DD_OBSERVACION_ESTADOS.ABIERTA },
      data: { estado: DD_OBSERVACION_ESTADOS.RESUELTA, fechaResolucion: dateUtils.now() },
    });
  }

  async actualizarEstado(id: string, data: DdEstadoExpedienteData): Promise<DdExpedienteEntity> {
    const row = await prisma.debidaDiligencia.update({
      where: { id },
      data: {
        estado: data.estado,
        fechaEnvio: data.fechaEnvio ?? undefined,
        fechaRevision: data.fechaRevision ?? undefined,
        fechaAprobacion: data.fechaAprobacion === undefined ? undefined : data.fechaAprobacion,
        fechaVencimiento: data.fechaVencimiento === undefined ? undefined : data.fechaVencimiento,
        fechaRechazo: data.fechaRechazo === undefined ? undefined : data.fechaRechazo,
        revisadoPor: data.revisadoPor ?? undefined,
        motivoRechazo: data.motivoRechazo ?? undefined,
        fechaDerivacionLegal: data.fechaDerivacionLegal ?? undefined,
        derivadoLegalPor: data.derivadoLegalPor ?? undefined,
        fechaLegal: data.fechaLegal ?? undefined,
        legalRevisor: data.legalRevisor ?? undefined,
        decisionLegal: data.decisionLegal ?? undefined,
        motivoLegal: data.motivoLegal ?? undefined,
        informeLegalNombre: data.informeLegalNombre ?? undefined,
        informeLegalUrl: data.informeLegalUrl ?? undefined,
        actualizadoPor: data.actualizadoPor ?? undefined,
      },
      include: expedienteInclude,
    });
    return mapExpediente(row);
  }

  async listarBandeja(params: DdBandejaParams): Promise<DdBandejaResult> {
    const ahora = dateUtils.now();
    const limiteVencimiento = dateUtils.addDays(dateUtils.startOfDay(ahora), DD_DIAS_POR_VENCER);
    const where: Prisma.DebidaDiligenciaWhereInput = { eventoId: params.eventoId };

    if (params.estado === DD_FILTRO_POR_VENCER) {
      where.estado = DD_ESTADOS.APROBADA;
      where.fechaVencimiento = { gte: ahora, lte: limiteVencimiento };
    } else if (params.estado && params.estado !== DD_FILTRO_TODAS) {
      where.estado = params.estado;
    }

    if (params.origen && params.origen !== DD_FILTRO_TODAS) {
      where.origen = params.origen;
    }
    if (params.vinculo && params.vinculo !== DD_FILTRO_TODAS) {
      where.tipoRelacionComercial = params.vinculo;
    }
    if (params.documentos === DD_DOCUMENTOS_FILTRO.CON) {
      where.documentos = { some: {} };
    } else if (params.documentos === DD_DOCUMENTOS_FILTRO.SIN) {
      where.documentos = { none: {} };
    }

    if (params.reputacion && params.reputacion !== DD_FILTRO_TODAS) {
      if (params.reputacion === DD_REPUTACION_FILTRO_PENDIENTE) {
        where.AND = [
          {
            OR: [
              { reputacion: { some: { estado: { in: [DD_REPUTACION_ESTADOS.POR_REVISAR, DD_REPUTACION_ESTADOS.EN_ANALISIS] } } } },
              { reputacion: { none: {} } },
            ],
          },
        ];
      } else {
        where.reputacion = { some: { estado: params.reputacion } };
      }
    }

    if (params.asignacion && params.asignacion !== DD_FILTRO_TODAS) {
      if (params.asignacion === DD_ASIGNACION_FILTRO.IMPORTACION) {
        where.revisadoPor = DD_IMPORTACION_REVISOR;
      } else if (params.asignacion === DD_ASIGNACION_FILTRO.SIN_ASIGNAR) {
        where.revisadoPor = null;
      } else if (params.asignacion === DD_ASIGNACION_FILTRO.REVISOR) {
        where.revisadoPor = { not: null, notIn: [DD_IMPORTACION_REVISOR] };
      }
    }

    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { codigo: { contains: q, mode: "insensitive" } },
        { empresa: { razonSocial: { contains: q, mode: "insensitive" } } },
        { empresa: { ruc: { contains: q } } },
      ];
    }

    /* El filtro y el orden por solicitudes se resuelven sobre el conjunto completo. */
    const clasificarSolicitudes =
      (params.solicitudes === DD_SOLICITUDES_FILTRO.CON ||
        params.solicitudes === DD_SOLICITUDES_FILTRO.SIN) ||
      params.orden === DD_BANDEJA_ORDEN.SOLICITUDES;
    const orderBy = params.orden === DD_BANDEJA_ORDEN.CREADOS
      ? { createdAt: "desc" as const }
      : { updatedAt: "desc" as const };

    const [rows, total, grupos] = await Promise.all([
      prisma.debidaDiligencia.findMany({
        where,
        orderBy,
        ...(clasificarSolicitudes
          ? {}
          : {
              skip: (params.page - 1) * params.perPage,
              take: params.perPage,
            }),
        include: {
          empresa: { select: empresaSelect },
          documentos: { select: { tipo: true, estado: true } },
          observaciones: { where: { estado: DD_OBSERVACION_ESTADOS.ABIERTA }, select: { id: true } },
          reputacion: { select: { estado: true } },
        },
      }),
      prisma.debidaDiligencia.count({ where }),
      prisma.debidaDiligencia.groupBy({
        by: ["estado"],
        where: { eventoId: params.eventoId },
        _count: { _all: true },
      }),
    ]);

    const porEstado = new Map(grupos.map((g) => [g.estado, g._count._all]));
    const resumen = {
      total: grupos.reduce((acc, g) => acc + g._count._all, 0),
      pendientes: (porEstado.get(DD_ESTADOS.BORRADOR) ?? 0) + (porEstado.get(DD_ESTADOS.PENDIENTE) ?? 0),
      enRevision: porEstado.get(DD_ESTADOS.EN_REVISION) ?? 0,
      observadas: porEstado.get(DD_ESTADOS.OBSERVADA) ?? 0,
      aprobadas: porEstado.get(DD_ESTADOS.APROBADA) ?? 0,
      rechazadas: porEstado.get(DD_ESTADOS.RECHAZADA) ?? 0,
    };

    const solicitudesPorDocumento = await this.contarSolicitudesPorDocumento(
      rows.map((row) => row.empresa.ruc),
    );

    const contarSolicitudes = (row: (typeof rows)[number]): number =>
      solicitudesPorDocumento.get(normalizarDocumentoEmpresa(row.empresa.ruc)) ?? 0;

    let filas = [...rows];
    if (params.solicitudes === DD_SOLICITUDES_FILTRO.CON) {
      filas = filas.filter((row) => contarSolicitudes(row) > 0);
    } else if (params.solicitudes === DD_SOLICITUDES_FILTRO.SIN) {
      filas = filas.filter((row) => contarSolicitudes(row) === 0);
    }

    if (params.orden === DD_BANDEJA_ORDEN.SOLICITUDES) {
      filas.sort(
        (a, b) =>
          contarSolicitudes(b) - contarSolicitudes(a) ||
          b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
    }

    const totalVisibles = clasificarSolicitudes ? filas.length : total;
    const filasPagina = clasificarSolicitudes
      ? filas.slice((params.page - 1) * params.perPage, params.page * params.perPage)
      : filas;

    return {
      data: filasPagina.map((row) => {
        const reputacion = row.reputacion;
        const reputacionPendientes = reputacion.filter(
          (r) =>
            r.estado === DD_REPUTACION_ESTADOS.POR_REVISAR ||
            r.estado === DD_REPUTACION_ESTADOS.EN_ANALISIS,
        ).length;
        const reputacionSinHallazgos = reputacion.filter(
          (r) => r.estado === DD_REPUTACION_ESTADOS.SIN_HALLAZGOS,
        ).length;
        const reputacionConHallazgos = reputacion.filter(
          (r) => r.estado === DD_REPUTACION_ESTADOS.CON_HALLAZGOS,
        ).length;
        const reputacionRequiereInformacion = reputacion.filter(
          (r) => r.estado === DD_REPUTACION_ESTADOS.REQUIERE_INFORMACION,
        ).length;
        let reputacionEstado: DdBandejaRow["reputacionEstado"] = null;
        if (reputacion.length > 0) {
          if (reputacion.some((r) => r.estado === DD_REPUTACION_ESTADOS.CON_HALLAZGOS)) {
            reputacionEstado = DD_REPUTACION_ESTADOS.CON_HALLAZGOS;
          } else if (reputacion.some((r) => r.estado === DD_REPUTACION_ESTADOS.REQUIERE_INFORMACION)) {
            reputacionEstado = DD_REPUTACION_ESTADOS.REQUIERE_INFORMACION;
          } else if (reputacion.some((r) => r.estado === DD_REPUTACION_ESTADOS.POR_REVISAR || r.estado === DD_REPUTACION_ESTADOS.EN_ANALISIS)) {
            reputacionEstado = DD_REPUTACION_ESTADOS.POR_REVISAR;
          } else if (reputacion.some((r) => r.estado === DD_REPUTACION_ESTADOS.SIN_HALLAZGOS)) {
            reputacionEstado = DD_REPUTACION_ESTADOS.SIN_HALLAZGOS;
          } else {
            reputacionEstado = DD_REPUTACION_ESTADOS.CERRADA;
          }
        }
        return {
        id: row.id,
        codigo: row.codigo,
        estado: row.estado as DdEstado,
        origen: row.origen,
        estadoOrigen: row.estadoOrigen ?? null,
        eventoProyecto: row.eventoProyecto ?? null,
        motivoImportacion: row.motivoImportacion ?? null,
        tipoRelacionComercial: row.tipoRelacionComercial as DdMatrizRow["tipoRelacionComercial"],
        empresa: mapEmpresa(row.empresa),
        fechaCreacion: row.createdAt,
        solicitudesAlquiler: solicitudesPorDocumento.get(normalizarDocumentoEmpresa(row.empresa.ruc)) ?? 0,
        documentoCargados: row.documentos.filter(
          (d) => d.estado !== DD_DOCUMENTO_ESTADOS.PENDIENTE,
        ).length,
        documentoTotal: DD_DOCUMENTOS_REQUERIDOS.length,
        fechaEnvio: row.fechaEnvio ?? null,
        fechaAprobacion: row.fechaAprobacion ?? null,
        fechaVencimiento: row.fechaVencimiento ?? null,
        revisadoPor: row.revisadoPor ?? null,
        motivoRechazo: row.motivoRechazo ?? null,
        observacionesAbiertas: row.observaciones.length,
        reputacionCasos: reputacion.length,
        reputacionEstado,
        reputacionPendientes,
        reputacionSinHallazgos,
        reputacionConHallazgos,
        reputacionRequiereInformacion,
        };
      }),
      total: totalVisibles,
      page: params.page,
      perPage: params.perPage,
      totalPages: Math.ceil(totalVisibles / params.perPage),
      resumen,
    };
  }

  private async contarSolicitudesPorDocumento(documentos: string[]): Promise<Map<string, number>> {
    const buscados = new Set(documentos.map(normalizarDocumentoEmpresa).filter(Boolean));
    if (buscados.size === 0) return new Map();

    const solicitudes = await prisma.solicitud.findMany({
      where: { flgActivo: true },
      select: { datosFacturacion: true },
    });
    const conteo = new Map<string, number>();
    for (const solicitud of solicitudes) {
      const datos = solicitud.datosFacturacion as { numeroDocumento?: unknown } | null;
      const documento = typeof datos?.numeroDocumento === "string"
        ? normalizarDocumentoEmpresa(datos.numeroDocumento)
        : "";
      if (datos && buscados.has(documento)) {
        conteo.set(documento, (conteo.get(documento) ?? 0) + 1);
      }
    }
    return conteo;
  }

  async resumenPanel(eventoId: string): Promise<{
    kpis: DdPanelKpis;
    porVinculo: DdPanelVinculo[];
    vigencia: { vigentes: number; porVencer: number; vencidas: number; total: number };
  }> {
    const ahora = dateUtils.now();
    const limite = dateUtils.addDays(dateUtils.startOfDay(ahora), DD_DIAS_POR_VENCER);

    const [expedientes, empresas] = await Promise.all([
      prisma.debidaDiligencia.findMany({
        where: { eventoId },
        select: {
          estado: true,
          tipoRelacionComercial: true,
          fechaVencimiento: true,
          fechaAprobacion: true,
        },
      }),
      prisma.empresa.count({ where: { estado: ESTADOS_EMPRESA.ACTIVA } }),
    ]);

    let aprobadasVigentes = 0;
    let porVencer = 0;
    let enRevision = 0;
    let observadas = 0;
    let rechazadas = 0;
    let pendientes = 0;
    let vigentes = 0;
    let vencidas = 0;

    for (const expediente of expedientes) {
      if (expediente.estado === DD_ESTADOS.EN_REVISION) enRevision += 1;
      else if (expediente.estado === DD_ESTADOS.OBSERVADA) observadas += 1;
      else if (expediente.estado === DD_ESTADOS.RECHAZADA) rechazadas += 1;
      else if (expediente.estado === DD_ESTADOS.BORRADOR || expediente.estado === DD_ESTADOS.PENDIENTE) {
        pendientes += 1;
      }

      if (expediente.estado === DD_ESTADOS.APROBADA) {
        const vence = expediente.fechaVencimiento;
        if (!vence || vence > limite) {
          aprobadasVigentes += 1;
          vigentes += 1;
        } else if (vence > ahora) {
          porVencer += 1;
        } else {
          vencidas += 1;
        }
      }
    }

    const porVinculo: DdPanelVinculo[] = Object.values(DD_VINCULOS).map((vinculo) => {
      const delVinculo = expedientes.filter((e) => e.tipoRelacionComercial === vinculo);
      return {
        vinculo,
        label: DD_VINCULO_LABELS[vinculo] ?? vinculo,
        total: delVinculo.length,
        aprobadas: delVinculo.filter((e) => e.estado === DD_ESTADOS.APROBADA).length,
        observadas: delVinculo.filter((e) => e.estado === DD_ESTADOS.OBSERVADA).length,
        pendientes: delVinculo.filter(
          (e) => e.estado !== DD_ESTADOS.APROBADA && e.estado !== DD_ESTADOS.OBSERVADA,
        ).length,
      };
    });

    const sinVinculo = expedientes.filter((e) => !e.tipoRelacionComercial).length;
    if (sinVinculo > 0) {
      porVinculo.push({
        vinculo: "sin_vinculo",
        label: "Sin clasificar",
        total: sinVinculo,
        aprobadas: expedientes.filter(
          (e) => !e.tipoRelacionComercial && e.estado === DD_ESTADOS.APROBADA,
        ).length,
        observadas: expedientes.filter(
          (e) => !e.tipoRelacionComercial && e.estado === DD_ESTADOS.OBSERVADA,
        ).length,
        pendientes: expedientes.filter(
          (e) =>
            !e.tipoRelacionComercial &&
            e.estado !== DD_ESTADOS.APROBADA &&
            e.estado !== DD_ESTADOS.OBSERVADA,
        ).length,
      });
    }

    return {
      kpis: {
        total: expedientes.length,
        aprobadasVigentes,
        porVencer,
        enRevision,
        observadas,
        rechazadas,
        pendientes,
        empresasRegistradas: empresas,
      },
      porVinculo,
      vigencia: {
        vigentes,
        porVencer,
        vencidas,
        total: vigentes + porVencer + vencidas,
      },
    };
  }

  async listarMatriz(params: DdMatrizParams): Promise<DdMatrizResult> {
    const ahora = dateUtils.now();
    const limite = dateUtils.addDays(dateUtils.startOfDay(ahora), DD_DIAS_POR_VENCER);
    const where: Prisma.EmpresaWhereInput = { estado: ESTADOS_EMPRESA.ACTIVA };

    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { razonSocial: { contains: q, mode: "insensitive" } },
        { ruc: { contains: q } },
        { debidasDiligencias: { some: { eventoId: params.eventoId, codigo: { contains: q, mode: "insensitive" } } } },
      ];
    }

    const ddWhere: Prisma.DebidaDiligenciaWhereInput = { eventoId: params.eventoId };
    if (params.vinculo && params.vinculo !== DD_FILTRO_TODAS) {
      ddWhere.tipoRelacionComercial = params.vinculo;
    }

    if (params.estado === DD_FILTRO_SIN_INICIAR) {
      where.debidasDiligencias = { none: { eventoId: params.eventoId } };
    } else if (params.estado === DD_FILTRO_POR_VENCER) {
      ddWhere.estado = DD_ESTADOS.APROBADA;
      ddWhere.fechaVencimiento = { gte: ahora, lte: limite };
      where.debidasDiligencias = { some: ddWhere };
    } else if (params.estado && params.estado !== DD_FILTRO_TODAS) {
      ddWhere.estado = params.estado;
      where.debidasDiligencias = { some: ddWhere };
    } else if (params.vinculo && params.vinculo !== DD_FILTRO_TODAS) {
      where.debidasDiligencias = { some: ddWhere };
    }

    const [empresas, total] = await Promise.all([
      prisma.empresa.findMany({
        where,
        orderBy: { razonSocial: "asc" },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
        select: empresaSelect,
      }),
      prisma.empresa.count({ where }),
    ]);

    const expedientes = await prisma.debidaDiligencia.findMany({
      where: { eventoId: params.eventoId, empresaId: { in: empresas.map((e) => e.id) } },
      select: {
        id: true,
        empresaId: true,
        codigo: true,
        estado: true,
        tipoRelacionComercial: true,
        fechaAprobacion: true,
        fechaVencimiento: true,
        revisadoPor: true,
      },
    });

    const porEmpresa = new Map(expedientes.map((e) => [e.empresaId, e]));

    return {
      data: empresas.map((empresa) => {
        const expediente = porEmpresa.get(empresa.id);
        return {
          id: expediente?.id ?? `empresa-${empresa.id}`,
          empresa: mapEmpresa(empresa),
          codigo: expediente?.codigo ?? null,
          estado: (expediente?.estado as DdEstado | undefined) ?? null,
          tipoRelacionComercial:
            (expediente?.tipoRelacionComercial as DdMatrizRow["tipoRelacionComercial"]) ?? null,
          fechaAprobacion: expediente?.fechaAprobacion ?? null,
          fechaVencimiento: expediente?.fechaVencimiento ?? null,
          revisadoPor: expediente?.revisadoPor ?? null,
        };
      }),
      total,
      page: params.page,
      perPage: params.perPage,
      totalPages: Math.ceil(total / params.perPage),
    };
  }

  async listarClientes(params: DdClientesParams): Promise<DdClientesRawResult> {
    const ahora = dateUtils.now();
    const and: Prisma.DebidaDiligenciaWhereInput[] = [{ eventoId: params.eventoId }];

    if (params.estado && params.estado !== DD_FILTRO_TODAS) {
      and.push({ estado: params.estado });
    }
    if (params.ruc?.trim()) {
      and.push({ empresa: { ruc: params.ruc.trim() } });
    }
    if (params.search?.trim()) {
      const q = params.search.trim();
      and.push({
        OR: [
          { codigo: { contains: q, mode: "insensitive" } },
          { empresa: { razonSocial: { contains: q, mode: "insensitive" } } },
          { empresa: { ruc: { contains: q } } },
          { representanteNombre: { contains: q, mode: "insensitive" } },
          { emailRepresentante: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    if (params.resultado === DD_RESULTADOS.PENDIENTE) {
      and.push({
        estado: {
          in: [DD_ESTADOS.BORRADOR, DD_ESTADOS.PENDIENTE, DD_ESTADOS.EN_REVISION, DD_ESTADOS.OBSERVADA],
        },
      });
    } else if (params.resultado === DD_RESULTADOS.NO_APTO) {
      and.push({ estado: DD_ESTADOS.RECHAZADA });
    } else if (params.resultado === DD_RESULTADOS.APTO_CON_OBSERVACIONES) {
      and.push({
        estado: DD_ESTADOS.APROBADA,
        observaciones: { some: { estado: DD_OBSERVACION_ESTADOS.ABIERTA } },
      });
    } else if (params.resultado === DD_RESULTADOS.APTO) {
      and.push({
        estado: DD_ESTADOS.APROBADA,
        observaciones: { none: { estado: DD_OBSERVACION_ESTADOS.ABIERTA } },
      });
    }

    if (params.estadoEvaluacion === DD_ESTADOS_EVALUACION.VIGENTE) {
      and.push({
        estado: DD_ESTADOS.APROBADA,
        OR: [{ fechaVencimiento: null }, { fechaVencimiento: { gt: ahora } }],
      });
    } else if (params.estadoEvaluacion === DD_ESTADOS_EVALUACION.REQUIERE_NUEVA_EVALUACION) {
      and.push({
        OR: [
          { estado: { in: [DD_ESTADOS.OBSERVADA, DD_ESTADOS.RECHAZADA] } },
          { estado: DD_ESTADOS.APROBADA, fechaVencimiento: { lte: ahora } },
        ],
      });
    }

    const where: Prisma.DebidaDiligenciaWhereInput = { AND: and };

    const [rows, total, resumenRows] = await Promise.all([
      prisma.debidaDiligencia.findMany({
        where,
        include: expedienteInclude,
        orderBy: { updatedAt: "desc" },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
      prisma.debidaDiligencia.count({ where }),
      prisma.debidaDiligencia.findMany({
        where: { eventoId: params.eventoId },
        select: {
          estado: true,
          fechaVencimiento: true,
          documentos: { select: { tipo: true, estado: true } },
          observaciones: {
            where: { estado: DD_OBSERVACION_ESTADOS.ABIERTA },
            select: { id: true, documentoTipo: true },
          },
        },
      }),
    ]);

    let pendientes = 0;
    let aptos = 0;
    let aptosConObservaciones = 0;
    let noAptos = 0;
    let vigentes = 0;
    let requierenNuevaEvaluacion = 0;

    for (const expediente of resumenRows) {
      if (
        expediente.estado === DD_ESTADOS.BORRADOR ||
        expediente.estado === DD_ESTADOS.PENDIENTE ||
        expediente.estado === DD_ESTADOS.EN_REVISION ||
        expediente.estado === DD_ESTADOS.OBSERVADA
      ) {
        pendientes += 1;
      }
      if (expediente.estado === DD_ESTADOS.RECHAZADA) noAptos += 1;
      if (expediente.estado === DD_ESTADOS.APROBADA) {
        const estadosDocumento = new Map(
          expediente.documentos.map((documento) => [documento.tipo, documento.estado]),
        );
        const observacionesAbiertas = expediente.observaciones.filter(
          (observacion) =>
            !observacion.documentoTipo ||
            estadosDocumento.get(observacion.documentoTipo) !== DD_DOCUMENTO_ESTADOS.APROBADO,
        ).length;
        if (observacionesAbiertas > 0) aptosConObservaciones += 1;
        else aptos += 1;
        if (!expediente.fechaVencimiento || expediente.fechaVencimiento > ahora) vigentes += 1;
      }
      if (
        expediente.estado === DD_ESTADOS.OBSERVADA ||
        expediente.estado === DD_ESTADOS.RECHAZADA ||
        (expediente.estado === DD_ESTADOS.APROBADA &&
          expediente.fechaVencimiento !== null &&
          expediente.fechaVencimiento <= ahora)
      ) {
        requierenNuevaEvaluacion += 1;
      }
    }

    return {
      data: rows.map(mapExpediente),
      total,
      page: params.page,
      perPage: params.perPage,
      totalPages: Math.ceil(total / params.perPage),
      resumen: {
        total: resumenRows.length,
        pendientes,
        aptos,
        aptosConObservaciones,
        noAptos,
        vigentes,
        requierenNuevaEvaluacion,
      },
    };
  }

  async listarEmpresasEstados(params: DdEmpresasParams): Promise<DdEmpresasRawResult> {
    const ahora = dateUtils.now();
    const and: Prisma.DebidaDiligenciaEmpresaEstadoWhereInput[] = [];

    if (params.search?.trim()) {
      const q = params.search.trim();
      and.push({
        OR: [
          { razonSocial: { contains: q, mode: "insensitive" } },
          { documento: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    if (params.documento?.trim()) {
      and.push({ documento: params.documento.trim() });
    }
    if (params.resultado) {
      and.push({ resultado: params.resultado });
    }
    if (params.evento?.trim()) {
      and.push({ eventoProyecto: { contains: params.evento.trim(), mode: "insensitive" } });
    }
    if (params.estadoEvaluacion === DD_ESTADOS_EVALUACION.VIGENTE) {
      and.push({
        resultado: { in: [DD_RESULTADOS.APTO, DD_RESULTADOS.APTO_CON_OBSERVACIONES] },
        fechaVencimiento: { gt: ahora },
      });
    } else if (params.estadoEvaluacion === DD_ESTADOS_EVALUACION.REQUIERE_NUEVA_EVALUACION) {
      and.push({
        OR: [
          {
            resultado: { in: [DD_RESULTADOS.APTO, DD_RESULTADOS.APTO_CON_OBSERVACIONES] },
            fechaVencimiento: { lte: ahora },
          },
          {
            resultado: { in: [DD_RESULTADOS.APTO, DD_RESULTADOS.APTO_CON_OBSERVACIONES] },
            fechaVencimiento: null,
          },
        ],
      });
    }
    const where: Prisma.DebidaDiligenciaEmpresaEstadoWhereInput =
      and.length > 0 ? { AND: and } : {};

    const [rows, total, grupos, vigentes, vencidas] = await Promise.all([
      prisma.debidaDiligenciaEmpresaEstado.findMany({
        where,
        orderBy: { razonSocial: "asc" },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
      prisma.debidaDiligenciaEmpresaEstado.count({ where }),
      prisma.debidaDiligenciaEmpresaEstado.groupBy({
        by: ["resultado"],
        _count: { _all: true },
      }),
      prisma.debidaDiligenciaEmpresaEstado.count({
        where: {
          resultado: { in: [DD_RESULTADOS.APTO, DD_RESULTADOS.APTO_CON_OBSERVACIONES] },
          fechaVencimiento: { gt: ahora },
        },
      }),
      prisma.debidaDiligenciaEmpresaEstado.count({
        where: {
          resultado: { in: [DD_RESULTADOS.APTO, DD_RESULTADOS.APTO_CON_OBSERVACIONES] },
          OR: [{ fechaVencimiento: { lte: ahora } }, { fechaVencimiento: null }],
        },
      }),
    ]);

    const porResultado = new Map(grupos.map((grupo) => [grupo.resultado, grupo._count._all]));
    return {
      data: rows.map((row) => ({
        id: row.id,
        documento: row.documento,
        razonSocial: row.razonSocial,
        tipoDocumento: row.tipoDocumento as DdEmpresaEstadoEntity["tipoDocumento"],
        motivoEvaluacion: row.motivoEvaluacion ?? null,
        eventoProyecto: row.eventoProyecto ?? null,
        resultado: row.resultado as DdEmpresaEstadoEntity["resultado"],
        estadoOrigen: row.estadoOrigen,
        fechaIngreso: row.fechaIngreso ?? null,
        fechaRevision: row.fechaRevision ?? null,
        fechaVencimiento: row.fechaVencimiento ?? null,
        origen: row.origen,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      total,
      page: params.page,
      perPage: params.perPage,
      totalPages: Math.ceil(total / params.perPage),
      resumen: {
        total: grupos.reduce((acc, grupo) => acc + grupo._count._all, 0),
        aptos: porResultado.get(DD_RESULTADOS.APTO) ?? 0,
        aptosConObservaciones: porResultado.get(DD_RESULTADOS.APTO_CON_OBSERVACIONES) ?? 0,
        pendientes: porResultado.get(DD_RESULTADOS.PENDIENTE) ?? 0,
        noAptos: porResultado.get(DD_RESULTADOS.NO_APTO) ?? 0,
        vigentes,
        requierenNuevaEvaluacion: vencidas,
      },
    };
  }

  async upsertEmpresasEstados(
    rows: DdEmpresaEstadoImportData[],
  ): Promise<{ importados: number; actualizados: number }> {
    if (rows.length === 0) return { importados: 0, actualizados: 0 };
    const existentes = await prisma.debidaDiligenciaEmpresaEstado.findMany({
      where: { documento: { in: rows.map((row) => row.documento) } },
      select: { documento: true },
    });
    const documentosExistentes = new Set(existentes.map((row) => row.documento));
    await prisma.$transaction(
      rows.map((row) =>
        prisma.debidaDiligenciaEmpresaEstado.upsert({
          where: { documento: row.documento },
          update: {
            razonSocial: row.razonSocial,
            tipoDocumento: row.tipoDocumento,
            motivoEvaluacion: row.motivoEvaluacion,
            eventoProyecto: row.eventoProyecto,
            resultado: row.resultado,
            estadoOrigen: row.estadoOrigen,
            fechaIngreso: row.fechaIngreso,
            fechaRevision: row.fechaRevision,
            fechaVencimiento: row.fechaVencimiento,
            origen: "excel_dd",
          },
          create: {
            documento: row.documento,
            razonSocial: row.razonSocial,
            tipoDocumento: row.tipoDocumento,
            motivoEvaluacion: row.motivoEvaluacion,
            eventoProyecto: row.eventoProyecto,
            resultado: row.resultado,
            estadoOrigen: row.estadoOrigen,
            fechaIngreso: row.fechaIngreso,
            fechaRevision: row.fechaRevision,
            fechaVencimiento: row.fechaVencimiento,
            origen: "excel_dd",
          },
        }),
      ),
    );
    return {
      importados: rows.length - documentosExistentes.size,
      actualizados: documentosExistentes.size,
    };
  }

  async crearCasosReputacion(expedienteId: string, casos: DdReputacionCreacion[]): Promise<void> {
    if (casos.length === 0) return;
    await prisma.debidaDiligenciaReputacion.createMany({
      data: casos.map((caso) => ({
        expedienteId,
        nombreARevisar: caso.nombreARevisar,
        sitioWeb: caso.sitioWeb,
        derivadoPor: caso.derivadoPor,
      })),
      skipDuplicates: true,
    });
  }

  async listarReputacion(params: DdReputacionParams): Promise<DdReputacionResult> {
    const where: Prisma.DebidaDiligenciaReputacionWhereInput = {
      expediente: { eventoId: params.eventoId },
    };
    if (params.estado && params.estado !== DD_FILTRO_TODAS) {
      where.estado = params.estado;
    }
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { nombreARevisar: { contains: q, mode: "insensitive" } },
        { expediente: { codigo: { contains: q, mode: "insensitive" } } },
        { expediente: { empresa: { razonSocial: { contains: q, mode: "insensitive" } } } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.debidaDiligenciaReputacion.findMany({
        where,
        orderBy: { fechaDerivacion: "desc" },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
        include: reputacionInclude,
      }),
      prisma.debidaDiligenciaReputacion.count({ where }),
    ]);

    return {
      data: rows.map(mapReputacion),
      total,
      page: params.page,
      perPage: params.perPage,
      totalPages: Math.ceil(total / params.perPage),
    };
  }

  async actualizarReputacion(id: string, data: DdReputacionActualizacion): Promise<{ derivadoPor: string }> {
    return prisma.debidaDiligenciaReputacion.update({
      where: { id },
      data: {
        estado: data.estado,
        resultado: data.resultado,
        comentario: data.comentario,
        revisor: data.revisor,
        fechaCierre: data.cerrar ? dateUtils.now() : null,
      },
      select: { derivadoPor: true },
    });
  }

  async tieneCasosReputacion(expedienteId: string): Promise<boolean> {
    const total = await prisma.debidaDiligenciaReputacion.count({ where: { expedienteId } });
    return total > 0;
  }

  async registrarAuditoria(accion: string, entidad: string, actor: string, mensaje: string): Promise<void> {
    await prisma.auditLog.create({
      data: {
        tipo: "debida_diligencia",
        entidad,
        actor,
        mensaje,
        metadata: { accion },
      },
    });
  }

  async notificarLogistica(email: string, mensaje: string, url: string): Promise<void> {
    const cuenta = await prisma.userRole.findFirst({
      where: { email },
      select: { userId: true },
    });
    if (!cuenta) return;
    await prisma.alerta.create({
      data: {
        userId: cuenta.userId,
        tipo: "debida_diligencia_reputacion",
        titulo: "Revisión reputacional completada",
        mensaje,
        url,
      },
    });
  }
}
