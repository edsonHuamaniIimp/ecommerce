import type { FiltroUsuarioEmpresa } from "@/lib/shared/constants";

/** Fila de usuario del Portal del Cliente (con rol y empresa) para la bandeja de Usuarios. */
export interface UsuarioPortalRow {
  id: string;
  /** Identidad de la cuenta (user_id): agrupa sus filas cuando tiene varios roles. */
  userId: string;
  email: string;
  nombre: string | null;
  apellidos: string | null;
  telefono: string | null;
  /** RUC de la empresa vinculada (para re-resolver la ficha local al reasignar). */
  ruc: string | null;
  rol: string;
  empresaId: string | null;
  /** Codigo SIE de la empresa en la API de entidades (ej. E0000003804). */
  idEmpresa: string | null;
  empresa: string | null;
  /** true = tiene empresa vinculada (Portal del Cliente); false = usuario interno/sin empresa. */
  esPortal: boolean;
  /** Identificador de la persona en servicio-persona (sie_code). */
  sieCode: string | null;
  debeCambiarPassword: boolean;
  /** Acceso habilitado (flg_activo): false = deshabilitado, no puede ingresar. */
  flgActivo: boolean;
}

/** Parametros de la bandeja paginada de usuarios (paginacion/busqueda server-side). */
export interface UsuariosPaginationParams {
  page: number;
  perPage: number;
  search?: string;
  /** Filtro por vinculo con empresa; omitido = todos. */
  filtro?: FiltroUsuarioEmpresa;
}

export interface UsuariosPaginatedResult {
  data: UsuarioPortalRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface IUsuarioRepository {
  /** Bandeja paginada de usuarios (filtro y busqueda server-side). */
  listarUsuariosPortal(params: UsuariosPaginationParams): Promise<UsuariosPaginatedResult>;
  findUsuarioPortalById(id: string): Promise<UsuarioPortalRow | null>;
  actualizarUsuarioPortal(id: string, data: ActualizarUsuarioPortalData): Promise<UsuarioPortalRow>;
  actualizarPasswordUsuarioPortal(id: string, passwordHash: string, debeCambiarPassword: boolean): Promise<void>;
  /** Identificadores externos del usuario (servicio-persona): sie_code de la persona e id_empresa SIE. */
  findVinculacionPorEmail(email: string): Promise<VinculacionUsuario | null>;
  /** true si OTRA cuenta (userId distinto) ya usa ese correo. */
  existeEmailEnOtraCuenta(email: string, userId: string): Promise<boolean>;
}

/** Identificadores externos del usuario para cruzarlo con la fuente. */
export interface VinculacionUsuario {
  sieCode: string | null;
  /** Codigo SIE de la empresa (API de entidades / servicio-persona). */
  idEmpresa: string | null;
}

/** Cambios parciales de un usuario del portal (solo los campos presentes). */
export interface ActualizarUsuarioPortalData {
  empresaId?: string;
  /** Codigo SIE de la empresa (API de entidades). */
  idEmpresa?: string;
  /** Nombre de la empresa (campo legacy que acompana a empresaId). */
  nombreEmpresa?: string;
  nombre?: string | null;
  apellidos?: string | null;
  telefono?: string | null;
  /** Nuevo correo del acceso (login); el repo lo propaga a las filas del usuario. */
  email?: string;
  /** Estado del acceso (flg_activo); el repo lo propaga a las filas del usuario. */
  flgActivo?: boolean;
}
