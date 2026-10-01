/** Alta de empresa (backoffice). */
export interface CrearEmpresaRequestDTO {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string | null;
  direccionFiscal?: string | null;
  telefono?: string | null;
  emailContacto?: string | null;
  emailFacturacion?: string | null;
  representanteLegalNombre?: string | null;
  representanteLegalDni?: string | null;
  tipoComprobante?: string | null;
  sitioWeb?: string | null;
}

/** Edicion parcial de empresa: solo se actualizan los campos enviados. */
export interface ActualizarEmpresaRequestDTO extends Partial<CrearEmpresaRequestDTO> {
  id: string;
}

/** Activar/desactivar una empresa (baja logica). */
export interface CambiarEstadoEmpresaRequestDTO {
  id: string;
  estado: string;
}

/** Filtros de la bandeja de empresas. */
export interface ListarEmpresasQueryDTO {
  page?: number;
  perPage?: number;
  search?: string;
  estado?: string;
}
