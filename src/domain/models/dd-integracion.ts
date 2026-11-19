/** Versión histórica de un documento de Debida Diligencia. */
export interface DdIntegracionDocumentoVersionEntity {
  id: string;
  version: number;
  nombre: string;
  url: string;
  creadoPor: string | null;
  createdAt: Date;
}

/** Documento base de un expediente DD con todas sus versiones. */
export interface DdIntegracionDocumentoEntity {
  id: string;
  tipo: string;
  nombre: string;
  url: string;
  estado: string;
  observacion: string | null;
  updatedAt: Date;
  versionActual: number;
  versiones: DdIntegracionDocumentoVersionEntity[];
}

/** Expediente DD de una empresa. */
export interface DdIntegracionExpedienteEntity {
  id: string;
  codigo: string;
  estado: string;
  origen: string;
  evento: {
    id: string;
    nombre: string;
    anio: string;
  };
  fechaEnvio: Date | null;
  fechaRevision: Date | null;
  fechaAprobacion: Date | null;
  fechaVencimiento: Date | null;
  documentos: DdIntegracionDocumentoEntity[];
}

/** Empresa y todos sus expedientes/documentos DD. */
export interface DdIntegracionEmpresaEntity {
  id: string;
  ruc: string;
  tipoDocumento: "RUC" | "RUT";
  razonSocial: string;
  nombreComercial: string | null;
  pais: string;
  estado: string;
  expedientes: DdIntegracionExpedienteEntity[];
}

export interface DdIntegracionBusquedaParams {
  tipoDocumento?: "RUC" | "RUT";
  documento?: string;
  razonSocial?: string;
  page: number;
  perPage: number;
}

export interface DdIntegracionBusquedaResult {
  data: DdIntegracionEmpresaEntity[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
