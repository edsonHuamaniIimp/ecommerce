/** Alta de empresa (backoffice). */
export interface CrearEmpresaRequestDTO {
  ruc: string;
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
  tipoComprobante?: string | null;
  sitioWeb?: string | null;
}
