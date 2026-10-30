/** Empresa exhibidora registrada por el backoffice (respuesta API). */
/** Representante legal adicional de la empresa (el principal va en los campos representanteLegal*). */
export interface EmpresaRepresentanteAdicionalDTO {
  id: string;
  nombre: string;
  tipoDocumento: string;
  documento: string;
  correo: string | null;
  celular: string | null;
  direccion: string | null;
  orden: number;
}
export interface EmpresaDTO {
  id: string;
  /** Documento de la empresa: RUC (11 digitos) o RUT/no domiciliado (alfanumerico hasta 20). */
  ruc: string;
  /** Tipo de documento (TIPOS_DOCUMENTO_EMPRESA: "6" RUC, "0" no domiciliado/RUT). */
  tipoDocumento: string;
  /** Pais de la empresa (ISO 3166-1 alpha-2). */
  pais: string;
  /** Identificador de la empresa en servicio-persona (sie_code). */
  sieCode: string | null;
  razonSocial: string;
  /** Logo (URL) que se pinta en los stands reservados del mapa. */
  logoUrl: string | null;
  nombreComercial: string | null;
  direccionFiscal: string | null;
  /** Fecha de inicio de operaciones (YYYY-MM-DD). */
  inicioOperaciones: string | null;
  telefono: string | null;
  emailContacto: string | null;
  emailFacturacion: string | null;
  representanteLegalNombre: string | null;
  representanteLegalTipoDocumento: string;
  representanteLegalDni: string | null;
  representanteCorreo: string | null;
  representanteCelular: string | null;
  representanteDireccion: string | null;
  /** Datos adicionales de la solicitud de participacion. */
  nombreFriso: string | null;
  actividadEconomica: string | null;
  estadoContribuyente: string | null;
  facturarANombre: string | null;
  responsableExteminNombre: string | null;
  responsableExteminTelefono: string | null;
  responsableExteminTipoDocumento: string;
  responsableExteminDni: string | null;
  responsableExteminEmail: string | null;
  responsablePagosNombre: string | null;
  responsablePagosTelefono: string | null;
  responsablePagosTipoDocumento: string;
  responsablePagosDni: string | null;
  responsablePagosEmail: string | null;
  /** Partida electronica de inscripcion de poderes de la empresa. */
  partidaElectronica: string | null;
  /** Codigo SIE del representante en servicio-persona (null = aun no sincronizado). */
  representanteSieCode: string | null;
  /** Representantes adicionales activos. */
  representantesAdicionales: EmpresaRepresentanteAdicionalDTO[];
  /** Configuracion personalizada de cuotas (Modalidad 4); null = cronograma estandar. */
  configCuotas: { maxCuotas: number; fechas: string[] } | null;
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
