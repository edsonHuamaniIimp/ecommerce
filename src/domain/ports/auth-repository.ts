import type { UserRoleEntity } from "../models/entities";

export interface EventoInfo {
  id: string;
  eventoPadreId: string;
  eventoPadre: { nombre: string };
  anio: string;
  tipoEvento?: number;
  codigoEvento?: number;
}

export interface IAuthRepository {
  findByEmail(email: string): Promise<(UserRoleEntity & { password: string; role: { nombre: string; permisos: string[] } })[]>;
  findEventoById(id: string): Promise<EventoInfo | null>;
  findOrCreateEvento(tipoEvento: number, codigoEvento: number): Promise<{ id: string }>;
  findPerfilByEmail(email: string): Promise<{ email: string; nombre: string | null; apellidos: string | null; telefono: string | null; tipoUsuarioId: number | null; idEmpresa: string | null; nombreEmpresa: string | null } | null>;
  updatePerfil(email: string, data: { nombre?: string; apellidos?: string; telefono?: string; tipoUsuarioId?: number | null; idEmpresa?: string | null; nombreEmpresa?: string | null }): Promise<void>;
  findForReset(email: string): Promise<{ id: string; email: string; nombre: string | null } | null>;
  setResetToken(id: string, token: string, expires: Date): Promise<void>;
  findByResetToken(token: string): Promise<{ id: string } | null>;
  updatePassword(id: string, password: string): Promise<void>;
}
