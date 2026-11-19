import type {
  DdIntegracionBusquedaResult,
  DdIntegracionDocumentoEntity,
  DdIntegracionEmpresaEntity,
  DdIntegracionExpedienteEntity,
} from "@/domain/models/dd-integracion";
import type {
  DdIntegracionDocumentoDTO,
  DdIntegracionDocumentosResponseDTO,
  DdIntegracionEmpresaDTO,
  DdIntegracionExpedienteDTO,
} from "@/types/dto/debida-diligencia";

function fecha(valor: Date | null): string | null {
  return valor ? valor.toISOString() : null;
}

function mapDocumento(documento: DdIntegracionDocumentoEntity): DdIntegracionDocumentoDTO {
  return {
    id: documento.id,
    tipo: documento.tipo,
    nombre: documento.nombre,
    url: documento.url,
    estado: documento.estado,
    observacion: documento.observacion,
    updatedAt: documento.updatedAt.toISOString(),
    versionActual: documento.versionActual,
    versiones: documento.versiones.map((version) => ({
      id: version.id,
      version: version.version,
      nombre: version.nombre,
      url: version.url,
      creadoPor: version.creadoPor,
      createdAt: version.createdAt.toISOString(),
    })),
  };
}

function mapExpediente(expediente: DdIntegracionExpedienteEntity): DdIntegracionExpedienteDTO {
  return {
    id: expediente.id,
    codigo: expediente.codigo,
    estado: expediente.estado,
    origen: expediente.origen,
    evento: expediente.evento,
    fechaEnvio: fecha(expediente.fechaEnvio),
    fechaRevision: fecha(expediente.fechaRevision),
    fechaAprobacion: fecha(expediente.fechaAprobacion),
    fechaVencimiento: fecha(expediente.fechaVencimiento),
    documentos: expediente.documentos.map(mapDocumento),
  };
}

function mapEmpresa(empresa: DdIntegracionEmpresaEntity): DdIntegracionEmpresaDTO {
  return {
    id: empresa.id,
    ruc: empresa.ruc,
    tipoDocumento: empresa.tipoDocumento,
    razonSocial: empresa.razonSocial,
    nombreComercial: empresa.nombreComercial,
    pais: empresa.pais,
    estado: empresa.estado,
    expedientes: empresa.expedientes.map(mapExpediente),
  };
}

export function mapDdIntegracionDocumentosToDTO(
  resultado: DdIntegracionBusquedaResult,
): DdIntegracionDocumentosResponseDTO {
  return {
    empresas: resultado.data.map(mapEmpresa),
    total: resultado.total,
    page: resultado.page,
    perPage: resultado.perPage,
    totalPages: resultado.totalPages,
  };
}
