/**
 * Datos que la empresa confirma/actualiza en su primer ingreso al Portal.
 * Los campos contractuales alimentan el contrato; la validacion marca el primer acceso.
 */
export interface ValidarDatosEmpresaRequestDTO {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string | null;
  direccionFiscal?: string | null;
  telefono?: string | null;
  emailFacturacion?: string | null;
  representanteLegalNombre?: string | null;
  representanteLegalDni?: string | null;
  tipoComprobante?: string | null;
  sitioWeb?: string | null;
}
