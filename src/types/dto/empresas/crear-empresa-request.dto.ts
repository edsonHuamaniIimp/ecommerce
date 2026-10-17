/** Alta de empresa (backoffice). */
export interface CrearEmpresaRequestDTO {
  /** RUC (11 digitos) o RUT/no domiciliado (alfanumerico hasta 20). */
  ruc: string;
  /** Tipo de documento; omitido = autodetecta por el documento. */
  tipoDocumento?: string | null;
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
  representanteLegalDni?: string | null;
  partidaElectronica?: string | null;
  /** Datos del representante que viajan a servicio-persona (no se persisten localmente). */
  representanteDireccion?: string | null;
  representanteCorreo?: string | null;
  representanteCelular?: string | null;
  /** Foto del representante (URL /uploads o http) para subirla a servicio-persona. */
  representanteFotoUrl?: string | null;
  tipoComprobante?: string | null;
  sitioWeb?: string | null;
}
