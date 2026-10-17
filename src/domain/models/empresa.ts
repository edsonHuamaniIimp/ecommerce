import type { EstadoEmpresa, EstadoFilaCarga, TipoComprobante } from "@/lib/shared/constants";

/**
 * Empresa exhibidora registrada por el backoffice.
 * Los campos contractuales (razon social, RUC, direccion, representante legal)
 * alimentan el contrato de alquiler de stands.
 */
export interface EmpresaEntity {
  id: string;
  /** Documento de la empresa: RUC (11 digitos) o RUT/no domiciliado (alfanumerico hasta 20). */
  ruc: string;
  /** Tipo de documento (ver TIPOS_DOCUMENTO_EMPRESA: "6" RUC, "0" no domiciliado/RUT). */
  tipoDocumento: string;
  /** Identificador de la empresa en servicio-persona (sie_code, ej. E0000000123). */
  sieCode: string | null;
  razonSocial: string;
  /** Logo (URL en /uploads/*) que se pinta en los stands reservados del mapa. */
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
  /** Codigo SIE de la persona del representante en servicio-persona (null = aun solo local). */
  representanteSieCode: string | null;
  partidaElectronica: string | null;
  tipoComprobante: TipoComprobante;
  sitioWeb: string | null;
  estado: EstadoEmpresa;
  cuentaCreada: boolean;
  /** Correo de acceso de la cuenta vinculada; se completa en el listado (null si no se consulto). */
  cuentaEmail?: string | null;
  primerAccesoCompletado: boolean;
  datosValidadosEn: Date | null;
  creadoPor: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos de alta/edicion de una empresa (entrada del backoffice). */
export interface EmpresaInput {
  /** RUC o RUT/no domiciliado (se normaliza: mayusculas sin separadores). */
  ruc: string;
  /** Tipo de documento (RUC/RUT); omitido = autodetecta por el documento. */
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
  /** Correo y celular del representante (se persisten y se usan para su cuenta). */
  representanteCorreo?: string | null;
  representanteCelular?: string | null;
  /** Datos del representante para servicio-persona (no se persisten en la ficha local). */
  representanteDireccion?: string | null;
  /** Foto del representante (URL local /uploads o http) para subirla a servicio-persona. */
  representanteFotoUrl?: string | null;
  tipoComprobante?: string | null;
  sitioWeb?: string | null;
}

/** Datos normalizados que persiste el repositorio al crear. */
export interface CrearEmpresaData {
  ruc: string;
  /** Tipo de documento de empresa (TIPOS_DOCUMENTO_EMPRESA). */
  tipoDocumento: string;
  /** Identificador de la empresa en servicio-persona (sie_code). */
  sieCode: string | null;
  razonSocial: string;
  logoUrl: string | null;
  nombreComercial: string | null;
  direccionFiscal: string | null;
  telefono: string | null;
  emailContacto: string | null;
  emailFacturacion: string | null;
  representanteLegalNombre: string | null;
  representanteLegalDni: string | null;
  /** Correo y celular del representante (se persisten en la ficha). */
  representanteCorreo: string | null;
  representanteCelular: string | null;
  representanteDireccion: string | null;
  /** Codigo SIE del representante en servicio-persona (null = aun no sincronizado). */
  representanteSieCode: string | null;
  /** Partida electronica de poderes del representante (si aplica). */
  partidaElectronica: string | null;
  tipoComprobante: TipoComprobante;
  sitioWeb: string | null;
  creadoPor: string | null;
}

export interface EmpresasListParams {
  page: number;
  perPage: number;
  search?: string;
  estado?: string;
}

export interface EmpresasPaginatedResult {
  data: EmpresaEntity[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/* ================================================================
   Carga masiva (Excel / CSV)
   ================================================================ */

/** Fila cruda leida del archivo de carga masiva (valores de texto). */
export interface FilaCargaEmpresa {
  /** Numero de fila del archivo (1 = encabezado; datos desde 2). */
  numero: number;
  /** Tipo de documento declarado en el archivo ("" = autodetectar por el documento). */
  tipoDocumento: string;
  /** RUC o RUT/no domiciliado tal como viene en el archivo (se normaliza al validar). */
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  direccionFiscal: string;
  telefono: string;
  emailContacto: string;
  emailFacturacion: string;
  representanteLegalNombre: string;
  representanteLegalDni: string;
  tipoComprobante: string;
  sitioWeb: string;
}

/** Fila validada de la carga masiva (estado + motivos). */
export interface FilaCargaValidada extends FilaCargaEmpresa {
  estado: EstadoFilaCarga;
  mensajes: string[];
  /** sie_code completado desde servicio-persona al validar (se persiste al importar). */
  sieCode: string | null;
  /** true = la empresa ya existe en el backoffice con su cuenta de acceso creada. */
  tieneCuenta?: boolean;
}

export interface ResumenCargaEmpresas {
  listas: number;
  advertencias: number;
  errores: number;
}

export interface PrevisualizacionCargaEmpresas {
  filas: FilaCargaValidada[];
  resumen: ResumenCargaEmpresas;
}

export interface ResultadoImportacionEmpresas {
  creadas: number;
  omitidas: number;
}

/** Resultado de crear la cuenta del Portal / reenviar credenciales. */
export interface ResultadoCredencialesEmpresa {
  /** Correo (usuario) de la cuenta del Portal; provisional (`acceso-<ruc>@acceso.iimp`) si se creo solo con RUC. */
  email: string;
  /** Usuario de acceso: el correo de la cuenta o el RUC (cuentas sin correo real). */
  usuario: string;
  /** Contrasena temporal generada; se muestra una vez al administrador. */
  passwordTemporal: string;
  /** true = correo enviado; false = no se pudo enviar; null = sin envio (cuenta provisional sin correo real). */
  emailEnviado: boolean | null;
}

/** Resultado por empresa de la creacion masiva de cuentas. */
export interface ResultadoCuentaEmpresa {
  /** Documento de la empresa (RUC o RUT). */
  ruc: string;
  /** Tipo de documento (TIPOS_DOCUMENTO_EMPRESA). */
  tipoDocumento: string;
  razonSocial: string;
  /** Usuario de acceso (documento) si la cuenta se creo. */
  usuario: string | null;
  /** Contrasena temporal (se muestra una vez al administrador). */
  passwordTemporal: string | null;
  creada: boolean;
  error: string | null;
}

export interface ResultadoCreacionCuentasEmpresas {
  creadas: number;
  omitidas: number;
  resultados: ResultadoCuentaEmpresa[];
}
