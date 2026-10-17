/** Empresa exhibidora registrada por el backoffice (respuesta API). */
export interface EmpresaDTO {
  id: string;
  /** Documento de la empresa: RUC (11 digitos) o RUT/no domiciliado (alfanumerico hasta 20). */
  ruc: string;
  /** Tipo de documento (TIPOS_DOCUMENTO_EMPRESA: "6" RUC, "0" no domiciliado/RUT). */
  tipoDocumento: string;
  /** Identificador de la empresa en servicio-persona (sie_code). */
  sieCode: string | null;
  razonSocial: string;
  /** Logo (URL) que se pinta en los stands reservados del mapa. */
  logoUrl: string | null;
  nombreComercial: string | null;
  direccionFiscal: string | null;
  telefono: string | null;
  emailContacto: string | null;
  emailFacturacion: string | null;
  representanteLegalNombre: string | null;
  representanteLegalDni: string | null;
  representanteCorreo: string | null;
  representanteCelular: string | null;
  representanteDireccion: string | null;
  /** Codigo SIE del representante en servicio-persona (null = aun no sincronizado). */
  representanteSieCode: string | null;
  partidaElectronica: string | null;
  tipoComprobante: string;
  sitioWeb: string | null;
  estado: string;
  cuentaCreada: boolean;
  /** Correo de acceso de la cuenta vinculada (`acceso-<documento>@acceso.iimp` si es provisional); null si no existe o no se consulto. */
  cuentaEmail: string | null;
  primerAccesoCompletado: boolean;
  datosValidadosEn: string | null;
  creadoPor: string | null;
  createdAt: string;
  updatedAt: string;
}
