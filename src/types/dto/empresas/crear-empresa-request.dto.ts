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
