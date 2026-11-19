export interface DdIntegracionDocumentoVersionDTO {
  id: string;
  version: number;
  nombre: string;
  url: string;
  creadoPor: string | null;
  createdAt: string;
}

export interface DdIntegracionDocumentoDTO {
  id: string;
  tipo: string;
  titulo: string;
  nombre: string;
  url: string;
  estado: string;
  observacion: string | null;
  updatedAt: string;
  versionActual: number;
  versiones: DdIntegracionDocumentoVersionDTO[];
}

export interface DdIntegracionExpedienteDTO {
  id: string;
  codigo: string;
  estado: string;
  origen: string;
  evento: {
    id: string;
    nombre: string;
    anio: string;
  };
  fechaEnvio: string | null;
  fechaRevision: string | null;
  fechaAprobacion: string | null;
  fechaVencimiento: string | null;
  documentos: DdIntegracionDocumentoDTO[];
}

export interface DdIntegracionEmpresaDTO {
  id: string;
  ruc: string;
  tipoDocumento: "RUC" | "RUT";
  razonSocial: string;
  nombreComercial: string | null;
  pais: string;
  estado: string;
  expedientes: DdIntegracionExpedienteDTO[];
}

export interface DdIntegracionDocumentosResponseDTO {
  empresas: DdIntegracionEmpresaDTO[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
