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
  /** Correo (usuario) de la cuenta del Portal. */
  email: string;
  /** True si el correo con las credenciales se envio correctamente. */
  emailEnviado: boolean;
}
