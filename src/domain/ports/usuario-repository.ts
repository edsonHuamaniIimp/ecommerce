/** Fila de usuario del Portal del Cliente (con rol y empresa) para la bandeja de Usuarios. */
export interface UsuarioPortalRow {
  id: string;
  email: string;
  nombre: string | null;
  apellidos: string | null;
  telefono: string | null;
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
}

export interface IUsuarioRepository {
  /** Usuarios del Portal del Cliente (los vinculados a una empresa). */
  listarUsuariosPortal(): Promise<UsuarioPortalRow[]>;
  findUsuarioPortalById(id: string): Promise<UsuarioPortalRow | null>;
  actualizarUsuarioPortal(id: string, data: ActualizarUsuarioPortalData): Promise<UsuarioPortalRow>;
  actualizarPasswordUsuarioPortal(id: string, passwordHash: string, debeCambiarPassword: boolean): Promise<void>;
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
}
