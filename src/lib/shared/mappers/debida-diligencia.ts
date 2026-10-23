import type {
  DdBandejaResult,
  DdClientesResult,
  DdEmpresaEstadoEntity,
  DdEmpresaResumen,
  DdEvaluacionEmpresa,
  DdEmpresasResult,
  DdExpedienteEntity,
  DdHistorialEventoEntity,
  DdMatrizResult,
  DdMatrizRow,
  DdObservacionEntity,
  DdPanelData,
  DdReputacionGrupo,
  DdReputacionResult,
} from "@/domain/models/debida-diligencia";
import type { SolicitudDdEstadoDTO } from "@/types/dto/solicitudes/solicitud-dd-estado.dto";
import type { DdEstadoExternoDTO } from "@/types/dto/debida-diligencia";
import type {
  DdBandejaResponseDTO,
  DdBandejaRowDTO,
  DdClientesResponseDTO,
  DdEmpresaDTO,
  DdEmpresasResponseDTO,
  DdExpedienteDTO,
  DdHistorialResponseDTO,
  DdMatrizResponseDTO,
  DdMatrizRowDTO,
  DdPanelDTO,
  DdReputacionGrupoDTO,
  DdReputacionResponseDTO,
  DdReputacionRowDTO,
} from "@/types/dto/debida-diligencia";
import {
  DD_DOCUMENTOS_REQUERIDOS,
  DD_ESTADO_EVALUACION_LABELS,
  DD_ESTADOS_EVALUACION,
  DD_HISTORIAL_TIPO_LABELS,
  DD_HISTORIAL_TIPOS,
  DD_OBSERVACION_AREA_LABELS,
  DD_OBSERVACION_ESTADOS,
  DD_RESULTADO_LABELS,
  DD_RESULTADOS,
  DD_TIPOS_DOCUMENTO_EMPRESA,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { ddUtils } from "@/lib/shared/utils/debida-diligencia";

function fecha(iso: Date | null | undefined): string | null {
  return iso ? dateUtils.toIso(iso) : null;
}

export function mapDdEmpresaToDTO(empresa: DdEmpresaResumen): DdEmpresaDTO {
  return {
    id: empresa.id,
    ruc: empresa.ruc,
    tipoDocumento: empresa.tipoDocumento ?? null,
    razonSocial: empresa.razonSocial,
    nombreComercial: empresa.nombreComercial,
    sitioWeb: empresa.sitioWeb,
    emailContacto: empresa.emailContacto,
    representanteLegalNombre: empresa.representanteLegalNombre,
    representanteLegalDni: empresa.representanteLegalDni,
    representanteCorreo: empresa.representanteCorreo,
    logoUrl: empresa.logoUrl,
  };
}

export function mapDdExpedienteToDTO(expediente: DdExpedienteEntity): DdExpedienteDTO {
  return {
    id: expediente.id,
    empresaId: expediente.empresaId,
    eventoId: expediente.eventoId,
    codigo: expediente.codigo,
    estado: expediente.estado,
    origen: expediente.origen,
    estadoOrigen: expediente.estadoOrigen,
    eventoProyecto: expediente.eventoProyecto,
    motivoImportacion: expediente.motivoImportacion,
    importacionId: expediente.importacionId,
    tipoRelacionComercial: expediente.tipoRelacionComercial,
    actividadEconomica: expediente.actividadEconomica,
    actividadEconomicaOtro: expediente.actividadEconomicaOtro,
    paisConstitucion: expediente.paisConstitucion,
    sitioWeb: expediente.sitioWeb,
    emailRepresentante: expediente.emailRepresentante,
    aceptaDatos: expediente.aceptaDatos,
    aceptaVerificacion: expediente.aceptaVerificacion,
    declaraVerdad: expediente.declaraVerdad,
    representanteNombre: expediente.representanteNombre,
    representanteTipoDocumento: expediente.representanteTipoDocumento,
    representanteDocumento: expediente.representanteDocumento,
    representanteNacionalidad: expediente.representanteNacionalidad,
    fechaEnvio: fecha(expediente.fechaEnvio),
    fechaRevision: fecha(expediente.fechaRevision),
    fechaAprobacion: fecha(expediente.fechaAprobacion),
    fechaVencimiento: fecha(expediente.fechaVencimiento),
    fechaRechazo: fecha(expediente.fechaRechazo),
    revisadoPor: expediente.revisadoPor,
    motivoRechazo: expediente.motivoRechazo,
    fechaDerivacionLegal: fecha(expediente.fechaDerivacionLegal),
    derivadoLegalPor: expediente.derivadoLegalPor,
    informeLogisticaUrl: expediente.informeLogisticaUrl,
    fechaLegal: fecha(expediente.fechaLegal),
    legalRevisor: expediente.legalRevisor,
    decisionLegal: expediente.decisionLegal,
    motivoLegal: expediente.motivoLegal,
    informeLegalNombre: expediente.informeLegalNombre,
    informeLegalUrl: expediente.informeLegalUrl,
    creadoPor: expediente.creadoPor,
    actualizadoPor: expediente.actualizadoPor,
    createdAt: dateUtils.toIso(expediente.createdAt),
    updatedAt: dateUtils.toIso(expediente.updatedAt),
    empresa: mapDdEmpresaToDTO(expediente.empresa),
    evento: expediente.evento,
    beneficiarios: expediente.beneficiarios.map((b) => ({ ...b })),
    documentos: expediente.documentos.map((d) => ({
      id: d.id,
      tipo: d.tipo,
      nombre: d.nombre,
      url: d.url,
      estado: d.estado,
      observacion: d.observacion,
      updatedAt: dateUtils.toIso(d.updatedAt),
      versiones: (d.versiones.length > 0
        ? d.versiones
        : [
            {
              id: d.id,
              version: 1,
              nombre: d.nombre,
              url: d.url,
              creadoPor: null,
              createdAt: d.updatedAt,
            },
          ]
      ).map((v) => ({
        id: v.id,
        version: v.version,
        nombre: v.nombre,
        url: v.url,
        creadoPor: v.creadoPor,
        createdAt: dateUtils.toIso(v.createdAt),
      })),
    })),
    observaciones: expediente.observaciones.map((o) => ({
      id: o.id,
      area: o.area,
      documentoTipo: o.documentoTipo,
      texto: o.texto,
      estado: o.estado,
      creadoPor: o.creadoPor,
      fechaResolucion: fecha(o.fechaResolucion),
      createdAt: dateUtils.toIso(o.createdAt),
    })),
    reputacion: expediente.reputacion.map((r) => ({
      id: r.id,
      nombreARevisar: r.nombreARevisar,
      sitioWeb: r.sitioWeb,
      estado: r.estado,
      resultado: r.resultado,
      comentario: r.comentario,
      linkHallazgos: r.linkHallazgos,
      derivadoPor: r.derivadoPor,
      fechaDerivacion: dateUtils.toIso(r.fechaDerivacion),
      revisor: r.revisor,
      fechaCierre: fecha(r.fechaCierre),
      createdAt: dateUtils.toIso(r.createdAt),
      updatedAt: dateUtils.toIso(r.updatedAt),
    })),
  };
}

/** Une eventos de workflow y observaciones en una linea de tiempo descendente. */
export function mapDdHistorialToDTO(
  eventos: DdHistorialEventoEntity[],
  observaciones: DdObservacionEntity[],
): DdHistorialResponseDTO {
  const items = [
    ...eventos.map((evento) => ({
      id: evento.id,
      tipo: evento.tipo,
      tipoLabel: DD_HISTORIAL_TIPO_LABELS[evento.tipo],
      area: evento.area,
      areaLabel: evento.area ? DD_OBSERVACION_AREA_LABELS[evento.area] ?? evento.area : null,
      estado: evento.estado,
      titulo: evento.titulo,
      detalle: evento.detalle,
      actor: evento.actor,
      documentoTipo: null,
      documentoTitulo: null,
      fecha: dateUtils.toIso(evento.createdAt),
      fechaResolucion: null,
      metadata: evento.metadata,
    })),
    ...observaciones.map((observacion) => {
      const documentoTitulo = observacion.documentoTipo
        ? DD_DOCUMENTOS_REQUERIDOS.find((documento) => documento.tipo === observacion.documentoTipo)?.titulo ??
          observacion.documentoTipo
        : null;
      const areaLabel = DD_OBSERVACION_AREA_LABELS[observacion.area] ?? observacion.area;
      return {
        id: observacion.id,
        tipo: DD_HISTORIAL_TIPOS.OBSERVACION,
        tipoLabel: DD_HISTORIAL_TIPO_LABELS[DD_HISTORIAL_TIPOS.OBSERVACION],
        area: observacion.area,
        areaLabel,
        estado: observacion.estado,
        titulo: documentoTitulo
          ? `${areaLabel} observó ${documentoTitulo}`
          : `${areaLabel} registró una observación`,
        detalle: observacion.texto,
        actor: observacion.creadoPor,
        documentoTipo: observacion.documentoTipo,
        documentoTitulo,
        fecha: dateUtils.toIso(observacion.createdAt),
        fechaResolucion: fecha(observacion.fechaResolucion),
        metadata:
          observacion.estado === DD_OBSERVACION_ESTADOS.RESUELTA
            ? { resuelta: true }
            : null,
      };
    }),
  ];
  return {
    items: items.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
  };
}

export function mapDdClientesToDTO(resultado: DdClientesResult): DdClientesResponseDTO {
  return {
    items: resultado.data.map((item) => ({
      expediente: mapDdExpedienteToDTO(item.expediente),
      resultado: item.resultado,
      resultadoLabel: DD_RESULTADO_LABELS[item.resultado],
      estadoEvaluacion: item.estadoEvaluacion,
      estadoEvaluacionLabel: item.estadoEvaluacion
        ? DD_ESTADO_EVALUACION_LABELS[item.estadoEvaluacion]
        : null,
      vigente: item.vigente,
      diasVigenciaRestantes: item.diasVigenciaRestantes,
      aptoParaContratar: item.aptoParaContratar,
      alcance: item.alcance,
      observacionesAbiertas: item.observacionesAbiertas,
    })),
    pagination: {
      page: resultado.page,
      perPage: resultado.perPage,
      total: resultado.total,
      totalPages: resultado.totalPages,
    },
    resumen: resultado.resumen,
  };
}

export function mapDdEstadoExternoToDTO(
  estado: DdEmpresaEstadoEntity | null,
): DdEstadoExternoDTO | null {
  if (!estado) return null;
  const fechaVencimiento =
    estado.fechaVencimiento ??
    (estado.fechaRevision ? ddUtils.sumarMeses(estado.fechaRevision) : null);
  const estadoEvaluacion = ddUtils.estadoEvaluacionExterna(estado.resultado, fechaVencimiento);
  const vigente = estadoEvaluacion === DD_ESTADOS_EVALUACION.VIGENTE;
  return {
    resultado: estado.resultado,
    estadoEvaluacion,
    vigente,
    aptoParaContratar:
      vigente &&
      (estado.resultado === DD_RESULTADOS.APTO ||
        estado.resultado === DD_RESULTADOS.APTO_CON_OBSERVACIONES),
    fechaVencimiento: fechaVencimiento ? dateUtils.toIso(fechaVencimiento) : null,
    origen: estado.origen,
  };
}

export function mapDdEvaluacionSolicitudToDTO(
  solicitudId: string,
  evaluacion: DdEvaluacionEmpresa,
): SolicitudDdEstadoDTO {
  return {
    solicitudId,
    empresaId: evaluacion.empresa?.id ?? null,
    empresaRazonSocial: evaluacion.empresa?.razonSocial ?? null,
    expedienteId: evaluacion.expediente?.id ?? null,
    codigo: evaluacion.expediente?.codigo ?? null,
    estado: evaluacion.expediente?.estado ?? null,
    resultado: evaluacion.resultado,
    estadoEvaluacion: evaluacion.estadoEvaluacion,
    vigente: evaluacion.vigente,
    aptoParaContratar: evaluacion.aptoParaContratar,
    mensaje: evaluacion.mensaje,
  };
}

export function mapDdEmpresasToDTO(resultado: DdEmpresasResult): DdEmpresasResponseDTO {
  return {
    items: resultado.data.map((item) => {
      const empresa = item.empresa;
      const tipoPersona =
        empresa.tipoDocumento === DD_TIPOS_DOCUMENTO_EMPRESA.RUC
          ? "PERSONA_JURIDICA"
          : empresa.tipoDocumento === DD_TIPOS_DOCUMENTO_EMPRESA.DNI
            ? "PERSONA_NATURAL"
            : "EXTRANJERO";
      return {
        id: empresa.id,
        documento: empresa.documento,
        razonSocial: empresa.razonSocial,
        tipoDocumento: empresa.tipoDocumento,
        tipoPersona,
        motivoEvaluacion: empresa.motivoEvaluacion,
        eventoProyecto: empresa.eventoProyecto,
        resultado: item.empresa.resultado,
        resultadoLabel: DD_RESULTADO_LABELS[item.empresa.resultado],
        estadoOrigen: empresa.estadoOrigen,
        estadoEvaluacion: item.estadoEvaluacion,
        estadoEvaluacionLabel: item.estadoEvaluacion
          ? DD_ESTADO_EVALUACION_LABELS[item.estadoEvaluacion]
          : null,
        vigente: item.vigente,
        fechaIngreso: fecha(empresa.fechaIngreso),
        fechaRevision: fecha(empresa.fechaRevision),
        fechaVencimiento: fecha(empresa.fechaVencimiento),
        diasVigenciaRestantes: item.diasVigenciaRestantes,
        puedeReservar: item.puedeReservar,
        puedeAvanzar: item.puedeAvanzar,
        mensaje: item.mensaje,
        origen: empresa.origen,
      };
    }),
    pagination: {
      page: resultado.page,
      perPage: resultado.perPage,
      total: resultado.total,
      totalPages: resultado.totalPages,
    },
    resumen: resultado.resumen,
  };
}

export function mapDdBandejaRowToDTO(row: DdBandejaResult["data"][number]): DdBandejaRowDTO {
  return {
    id: row.id,
    codigo: row.codigo,
    estado: row.estado,
    origen: row.origen,
    estadoOrigen: row.estadoOrigen,
    eventoProyecto: row.eventoProyecto,
    motivoImportacion: row.motivoImportacion,
    tipoRelacionComercial: row.tipoRelacionComercial,
    empresa: mapDdEmpresaToDTO(row.empresa),
    fechaCreacion: fecha(row.fechaCreacion),
    solicitudesAlquiler: row.solicitudesAlquiler,
    documentoCargados: row.documentoCargados,
    documentoTotal: row.documentoTotal,
    fechaEnvio: fecha(row.fechaEnvio),
    fechaAprobacion: fecha(row.fechaAprobacion),
    fechaVencimiento: fecha(row.fechaVencimiento),
    revisadoPor: row.revisadoPor,
    motivoRechazo: row.motivoRechazo,
    observacionesAbiertas: row.observacionesAbiertas,
    reputacionCasos: row.reputacionCasos,
    reputacionEstado: row.reputacionEstado,
    reputacionPendientes: row.reputacionPendientes,
    reputacionSinHallazgos: row.reputacionSinHallazgos,
    reputacionConHallazgos: row.reputacionConHallazgos,
    reputacionRequiereInformacion: row.reputacionRequiereInformacion,
  };
}

export function mapDdBandejaToDTO(resultado: DdBandejaResult): DdBandejaResponseDTO {
  return {
    data: resultado.data.map(mapDdBandejaRowToDTO),
    total: resultado.total,
    page: resultado.page,
    perPage: resultado.perPage,
    totalPages: resultado.totalPages,
    resumen: resultado.resumen,
  };
}

export function mapDdPanelToDTO(panel: DdPanelData): DdPanelDTO {
  return {
    kpis: panel.kpis,
    porVinculo: panel.porVinculo,
    vigencia: panel.vigencia,
  };
}

function mapDdMatrizRowToDTO(row: DdMatrizRow): DdMatrizRowDTO {
  return {
    id: row.id,
    empresa: mapDdEmpresaToDTO(row.empresa),
    codigo: row.codigo,
    estado: row.estado,
    tipoRelacionComercial: row.tipoRelacionComercial,
    fechaAprobacion: fecha(row.fechaAprobacion),
    fechaVencimiento: fecha(row.fechaVencimiento),
    revisadoPor: row.revisadoPor,
  };
}

export function mapDdMatrizToDTO(resultado: DdMatrizResult): DdMatrizResponseDTO {
  return {
    data: resultado.data.map(mapDdMatrizRowToDTO),
    total: resultado.total,
    page: resultado.page,
    perPage: resultado.perPage,
    totalPages: resultado.totalPages,
  };
}

export function mapDdReputacionRowToDTO(row: DdReputacionGrupo["casos"][number]): DdReputacionRowDTO {
  return {
    id: row.id,
    expedienteId: row.expedienteId,
    codigo: row.codigo,
    empresa: { razonSocial: row.empresa.razonSocial },
    nombreARevisar: row.nombreARevisar,
    sitioWeb: row.sitioWeb,
    estado: row.estado,
    resultado: row.resultado,
    comentario: row.comentario,
    linkHallazgos: row.linkHallazgos,
    derivadoPor: row.derivadoPor,
    fechaDerivacion: dateUtils.toIso(row.fechaDerivacion),
    revisor: row.revisor,
    fechaCierre: fecha(row.fechaCierre),
    observacionesAbiertas: row.observacionesAbiertas,
  };
}

function mapDdReputacionGrupoToDTO(grupo: DdReputacionGrupo): DdReputacionGrupoDTO {
  return {
    expedienteId: grupo.expedienteId,
    codigo: grupo.codigo,
    empresa: { razonSocial: grupo.empresa.razonSocial },
    casos: grupo.casos.map(mapDdReputacionRowToDTO),
    totalCasos: grupo.totalCasos,
    pendientes: grupo.pendientes,
    cerrados: grupo.cerrados,
    fechaDerivacion: dateUtils.toIso(grupo.fechaDerivacion),
  };
}

export function mapDdReputacionToDTO(resultado: DdReputacionResult): DdReputacionResponseDTO {
  return {
    data: resultado.data.map(mapDdReputacionGrupoToDTO),
    total: resultado.total,
    page: resultado.page,
    perPage: resultado.perPage,
    totalPages: resultado.totalPages,
  };
}
