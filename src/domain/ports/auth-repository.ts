import type { UserRoleEntity } from "../models/entities";

export interface EventoInfo {
  id: string;
  eventoPadreId: string;
  eventoPadre: { nombre: string };
  anio: string;
  tipoEvento?: number;
  codigoEvento?: number;
}

/** Datos minimos para crear una cuenta de exhibidor (auto-registro). */
export interface NuevoUsuarioAuth {
  userId: string;
  email: string;
  password: string;
  nombre: string;
  apellidos: string;
  telefono: string | null;
  nombreEmpresa: string;
  roleId: string;
}

/** Datos de un registro de exhibidor pendiente de verificacion por codigo. */
export interface RegistroPendienteData {
  email: string;
  codigo: string;
  password: string;
  nombre: string;
  apellidos: string;
  razonSocial: string;
  telefono: string | null;
  ruc: string | null;
  expiraEn: Date;
}

export interface RegistroPendienteEntity extends RegistroPendienteData {
  id: string;
  intentos: number;
}

export interface IAuthRepository {
  findByEmail(email: string): Promise<(UserRoleEntity & { password: string; role: { nombre: string; permisos: string[] } })[]>;
  existeEmail(email: string): Promise<boolean>;
  crearUsuario(data: NuevoUsuarioAuth): Promise<void>;
  upsertRegistroPendiente(data: RegistroPendienteData): Promise<void>;
  findRegistroPendiente(email: string): Promise<RegistroPendienteEntity | null>;
  actualizarIntentosRegistro(id: string, intentos: number): Promise<void>;
  eliminarRegistroPendiente(id: string): Promise<void>;
  findEventoById(id: string): Promise<EventoInfo | null>;
  findOrCreateEvento(tipoEvento: number, codigoEvento: number): Promise<{ id: string }>;
  findPerfilByEmail(email: string): Promise<{ email: string; nombre: string | null; apellidos: string | null; telefono: string | null; tipoUsuarioId: number | null; idEmpresa: string | null; nombreEmpresa: string | null } | null>;
  updatePerfil(email: string, data: { nombre?: string; apellidos?: string; telefono?: string; tipoUsuarioId?: number | null; idEmpresa?: string | null; nombreEmpresa?: string | null }): Promise<void>;
  findForReset(email: string): Promise<{ id: string; email: string; nombre: string | null } | null>;
  setResetToken(id: string, token: string, expires: Date): Promise<void>;
  findByResetToken(token: string): Promise<{ id: string } | null>;
  updatePassword(id: string, password: string): Promise<void>;
}
