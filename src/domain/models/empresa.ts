import type { EstadoEmpresa, EstadoFilaCarga, TipoComprobante } from "@/lib/shared/constants";

/**
 * Empresa exhibidora registrada por el backoffice.
 * Los campos contractuales (razon social, RUC, direccion, representante legal)
 * alimentan el contrato de alquiler de stands.
 */
export interface EmpresaEntity {
  id: string;
  ruc: string;
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
  /** Partida electronica de poderes del representante (si aplica). */
  partidaElectronica: string | null;
  tipoComprobante: TipoComprobante;
  sitioWeb: string | null;
  estado: EstadoEmpresa;
  cuentaCreada: boolean;
  primerAccesoCompletado: boolean;
  datosValidadosEn: Date | null;
  creadoPor: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos de alta/edicion de una empresa (entrada del backoffice). */
export interface EmpresaInput {
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

/** Resultado por empresa de la creacion masiva de cuentas (solo con RUC). */
export interface ResultadoCuentaEmpresa {
  ruc: string;
  razonSocial: string;
  /** Usuario de acceso (RUC) si la cuenta se creo. */
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
