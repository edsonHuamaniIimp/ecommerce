/**
 * Datos que la empresa confirma/actualiza en su primer ingreso al Portal.
 * Los campos contractuales alimentan el contrato; la validacion marca el primer acceso.
 */
export interface ValidarDatosEmpresaRequestDTO {
  ruc: string;
  /** Tipo de documento de empresa (TIPOS_DOCUMENTO_EMPRESA). */
  tipoDocumento?: string | null;
  razonSocial: string;
  /** Pais ISO 3166-1 alpha-2; omitido = PE. */
  pais?: string | null;
  nombreComercial?: string | null;
  direccionFiscal?: string | null;
  /** Fecha de inicio de operaciones (YYYY-MM-DD). */
  inicioOperaciones?: string | null;
  telefono?: string | null;
  emailContacto?: string | null;
  emailFacturacion?: string | null;
  representanteLegalNombre?: string | null;
  representanteLegalTipoDocumento?: string | null;
  representanteLegalDni?: string | null;
  /** Datos del representante legal (se guardan en la ficha local; el admin los sincroniza con servicio-persona). */
  representanteCorreo?: string | null;
  representanteCelular?: string | null;
  representanteDireccion?: string | null;
  partidaElectronica?: string | null;
  /** Datos adicionales de la solicitud de participacion. */
  nombreFriso?: string | null;
  actividadEconomica?: string | null;
  estadoContribuyente?: string | null;
  facturarANombre?: string | null;
  responsableExteminNombre?: string | null;
  responsableExteminTelefono?: string | null;
  responsableExteminTipoDocumento?: string | null;
  responsableExteminDni?: string | null;
  responsableExteminEmail?: string | null;
  responsablePagosNombre?: string | null;
  responsablePagosTelefono?: string | null;
  responsablePagosTipoDocumento?: string | null;
  responsablePagosDni?: string | null;
  responsablePagosEmail?: string | null;
  tipoComprobante?: string | null;
  sitioWeb?: string | null;
}
