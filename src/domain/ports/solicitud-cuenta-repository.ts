import type { SolicitudCuentaEntity } from "../models/entities";

export interface CrearSolicitudCuentaData {
  email: string;
  nombre: string;
  apellidos: string;
  telefono?: string | null;
  razonSocial: string;
  ruc?: string | null;
  cargo?: string | null;
  mensaje?: string | null;
}

/** Datos del usuario habilitado que se crea al aprobar una solicitud. */
export interface NuevoUsuarioCuentaData {
  userId: string;
  email: string;
  nombre: string;
  apellidos: string;
  telefono: string | null;
  nombreEmpresa: string;
  password: string;
  /** Token de invitacion para que el usuario defina su contrasena. */
  resetToken: string;
  resetTokenExpires: Date;
  roleId: string;
}

export interface ISolicitudCuentaRepository {
  /** True si el email ya tiene una solicitud pendiente de revision. */
  existePendientePorEmail(email: string): Promise<boolean>;
  /** True si el email ya corresponde a un usuario habilitado. */
  existeUsuarioPorEmail(email: string): Promise<boolean>;
  /** Registra la solicitud en estado pendiente. */
  crear(data: CrearSolicitudCuentaData): Promise<SolicitudCuentaEntity>;
  listar(estado?: string): Promise<SolicitudCuentaEntity[]>;
  findById(id: string): Promise<SolicitudCuentaEntity | null>;
  /**
   * Aprueba la solicitud y crea el usuario habilitado en una sola transaccion
   * (si falla la creacion del usuario, la solicitud no cambia de estado).
   */
  aprobar(
    id: string,
    data: { revisadoPor: string; usuario: NuevoUsuarioCuentaData },
  ): Promise<SolicitudCuentaEntity>;
  rechazar(
    id: string,
    data: { revisadoPor: string; motivoRechazo: string },
  ): Promise<SolicitudCuentaEntity>;
}
