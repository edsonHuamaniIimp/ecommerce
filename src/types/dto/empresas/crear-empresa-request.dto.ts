/** Alta de empresa (backoffice). */
export interface CrearEmpresaRequestDTO {
  /** RUC (11 digitos) o RUT/no domiciliado (alfanumerico hasta 20). */
  ruc: string;
  /** Tipo de documento; omitido = autodetecta por el documento. */
  tipoDocumento?: string | null;
  /** Pais ISO 3166-1 alpha-2; omitido = PE. */
  pais?: string | null;
  razonSocial: string;
  /** Codigo SIE ya conocido (padron IIMP): evita crear/consultar en servicio-persona. */
  sieCode?: string | null;
  logoUrl?: string | null;
  nombreComercial?: string | null;
  direccionFiscal?: string | null;
  telefono?: string | null;
  emailContacto?: string | null;
  emailFacturacion?: string | null;
  representanteLegalNombre?: string | null;
  representanteLegalTipoDocumento?: string | null;
  representanteLegalDni?: string | null;
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
  /** Datos del representante que viajan a servicio-persona (no se persisten localmente). */
  representanteDireccion?: string | null;
  representanteCorreo?: string | null;
  representanteCelular?: string | null;
  /** Foto del representante (URL /uploads o http) para subirla a servicio-persona. */
  representanteFotoUrl?: string | null;
  tipoComprobante?: string | null;
  sitioWeb?: string | null;
}
