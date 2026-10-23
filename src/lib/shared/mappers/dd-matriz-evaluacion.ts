import type { DdMatrizDetalleResultado, DdMatrizListarResultado } from "@/application/debida-diligencia/dd-matriz-evaluacion-service";
import type { DdMatrizExportItem } from "@/domain/models/dd-matriz-evaluacion";
import type { DdMatrizAdjuntoEntity, DdMatrizBloque, DdMatrizFilaEntity } from "@/domain/models/dd-matriz-evaluacion";
import type {
  DdMatrizAdjuntoDTO,
  DdMatrizBloqueDTO,
  DdMatrizEvaluacionDetalleDTO,
  DdMatrizEvaluacionExportFilaDTO,
  DdMatrizEvaluacionFilaDTO,
  DdMatrizEvaluacionResponseDTO,
  DdMatrizGeneralesDTO,
  DdMatrizListaDTO,
} from "@/types/dto/debida-diligencia";
import { listasAplicables } from "@/lib/shared/utils/dd-matriz-evaluacion";

const iso = (fecha: Date | null): string | null => (fecha ? fecha.toISOString() : null);
const soloFecha = (fecha: Date | null): string | null => (fecha ? fecha.toISOString().slice(0, 10) : null);

export function mapDdMatrizEvaluacionFilaToDTO(fila: DdMatrizFilaEntity): DdMatrizEvaluacionFilaDTO {
  return {
    id: fila.id,
    expedienteId: fila.expediente.expedienteId,
    codigo: fila.expediente.codigo,
    empresaRazonSocial: fila.expediente.empresaRazonSocial,
    empresaRuc: fila.expediente.empresaRuc,
    motivo: fila.expediente.motivo,
    eventoProyecto: fila.expediente.eventoProyecto,
    fechaIngreso: fila.expediente.fechaIngreso.toISOString(),
    tipo: fila.tipo,
    origen: fila.origen,
    nombre: fila.nombre,
    tipoDocumento: fila.tipoDocumento,
    documento: fila.documento,
    cargo: fila.cargo,
    ambito: fila.ambito,
    pais: fila.pais,
    sigResultado: fila.sigResultado,
    sigConclusion: fila.sigConclusion,
    repResultado: fila.repResultado,
    repConclusion: fila.repConclusion,
    cmpResultado: fila.cmpResultado,
    cmpConclusion: fila.cmpConclusion,
    resultadoFinal: fila.resultadoFinal,
    updatedAt: fila.updatedAt.toISOString(),
  };
}

export function mapDdMatrizEvaluacionListaToDTO(resultado: DdMatrizListarResultado): DdMatrizEvaluacionResponseDTO {
  return {
    data: resultado.data.map(mapDdMatrizEvaluacionFilaToDTO),
    total: resultado.total,
    page: resultado.page,
    perPage: resultado.perPage,
    totalPages: resultado.totalPages,
    paises: resultado.paises.map((p) => ({ pais: p.pais, total: p.total })),
    nuevas: resultado.nuevas,
  };
}

function mapBloque(bloque: DdMatrizBloque): DdMatrizBloqueDTO {
  return {
    fecha: iso(bloque.fecha),
    responsable: bloque.responsable,
    resultado: bloque.resultado,
    observaciones: bloque.observaciones,
    conclusion: bloque.conclusion,
  };
}

export function mapDdMatrizAdjuntoToDTO(adjunto: DdMatrizAdjuntoEntity): DdMatrizAdjuntoDTO {
  return {
    id: adjunto.id,
    categoria: adjunto.categoria,
    nombre: adjunto.nombre,
    url: adjunto.url,
    mimeType: adjunto.mimeType,
    tamano: adjunto.tamano,
    creadoPor: adjunto.creadoPor,
    createdAt: adjunto.createdAt.toISOString(),
  };
}

export function mapDdMatrizEvaluacionDetalleToDTO(detalle: DdMatrizDetalleResultado): DdMatrizEvaluacionDetalleDTO {
  const { vinculo, empresa, adjuntos, permisos } = detalle;
  const generalesOrigen = empresa ?? vinculo;
  const generales: DdMatrizGeneralesDTO = {
    fechaInicioActividades: soloFecha(generalesOrigen.fechaInicioActividades),
    estadoContribuyente: generalesOrigen.estadoContribuyente,
    direccionLegal: generalesOrigen.direccionLegal ?? vinculo.expediente.empresaDireccionFiscal,
    actividadEconomica: generalesOrigen.actividadEconomica ?? vinculo.expediente.actividadEconomica,
    motivo: generalesOrigen.motivo ?? vinculo.expediente.motivo,
    eventoProyecto: generalesOrigen.eventoProyecto ?? vinculo.expediente.eventoProyecto,
    paisEmpresa: empresa?.pais ?? vinculo.expediente.empresaPais,
    historialIimp: generalesOrigen.historialIimp,
    beneficioMutuo: generalesOrigen.beneficioMutuo,
  };
  const listas: DdMatrizListaDTO[] = listasAplicables(vinculo.tipo, vinculo.ambito).map((lista) => ({
    codigo: lista.codigo,
    label: lista.label,
    color: lista.color,
    valor: vinculo.listas[lista.codigo] ?? null,
  }));

  return {
    id: vinculo.id,
    tipo: vinculo.tipo,
    origen: vinculo.origen,
    nombre: vinculo.nombre,
    tipoDocumento: vinculo.tipoDocumento,
    documento: vinculo.documento,
    nacionalidad: vinculo.nacionalidad,
    cargo: vinculo.cargo,
    ambito: vinculo.ambito,
    ambitoEditado: vinculo.ambitoEditado,
    pais: vinculo.pais,
    paisEditado: vinculo.paisEditado,
    expediente: {
      expedienteId: vinculo.expediente.expedienteId,
      codigo: vinculo.expediente.codigo,
      estado: vinculo.expediente.estado,
      empresaRazonSocial: vinculo.expediente.empresaRazonSocial,
      empresaRuc: vinculo.expediente.empresaRuc,
      paisConstitucion: vinculo.expediente.paisConstitucion,
      actividadEconomica: vinculo.expediente.actividadEconomica,
      tipoRelacionComercial: vinculo.expediente.tipoRelacionComercial,
      motivo: vinculo.expediente.motivo,
      eventoProyecto: vinculo.expediente.eventoProyecto,
      fechaIngreso: vinculo.expediente.fechaIngreso.toISOString(),
      revisadoPor: vinculo.expediente.revisadoPor,
      fechaRevision: iso(vinculo.expediente.fechaRevision),
    },
    generales,
    listas,
    sig: mapBloque(vinculo.sig),
    reputacional: mapBloque(vinculo.reputacional),
    compliance: mapBloque(vinculo.compliance),
    resultadoFinal: vinculo.resultadoFinal,
    finalFecha: iso(vinculo.finalFecha),
    finalPor: vinculo.finalPor,
    adjuntos: adjuntos.map(mapDdMatrizAdjuntoToDTO),
    permisos,
    updatedAt: vinculo.updatedAt.toISOString(),
  };
}

/** Fila de exportacion en el formato de la matriz oficial; los datos generales salen de la fila de la empresa. */
export function mapDdMatrizExportFilaToDTO(item: DdMatrizExportItem): DdMatrizEvaluacionExportFilaDTO {
  const { vinculo, empresa } = item;
  const origen = empresa ?? vinculo;
  const ctx = vinculo.expediente;
  return {
    expedienteCodigo: ctx.codigo,
    fechaIngreso: ctx.fechaIngreso.toISOString(),
    fechaRevisionExpediente: iso(ctx.fechaRevision),
    revisadoPor: ctx.revisadoPor,
    empresa: {
      razonSocial: ctx.empresaRazonSocial,
      ruc: ctx.empresaRuc,
      ambito: origen.ambito,
      pais: origen.pais ?? ctx.empresaPais,
      fechaInicioActividades: soloFecha(origen.fechaInicioActividades),
      estadoContribuyente: origen.estadoContribuyente,
      direccionLegal: origen.direccionLegal ?? ctx.empresaDireccionFiscal,
      actividadEconomica: origen.actividadEconomica ?? ctx.actividadEconomica,
      motivo: origen.motivo ?? ctx.motivo,
      eventoProyecto: origen.eventoProyecto ?? ctx.eventoProyecto,
      historialIimp: origen.historialIimp,
      beneficioMutuo: origen.beneficioMutuo,
      listas: origen.listas,
    },
    vinculo: {
      tipo: vinculo.tipo,
      nombre: vinculo.nombre,
      tipoDocumento: vinculo.tipoDocumento,
      documento: vinculo.documento,
      nacionalidad: vinculo.nacionalidad,
      cargo: vinculo.cargo,
      ambito: vinculo.ambito,
      pais: vinculo.pais,
      listas: vinculo.listas,
      sig: mapBloque(vinculo.sig),
      reputacional: mapBloque(vinculo.reputacional),
      compliance: mapBloque(vinculo.compliance),
      resultadoFinal: vinculo.resultadoFinal,
    },
  };
}
