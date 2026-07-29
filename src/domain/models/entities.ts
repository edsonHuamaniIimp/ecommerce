import type { Rol } from "@/lib/constants";

export interface EventoPadreEntity {
  id: string;
  codigo: string;
  vertical: string;
  nombre: string;
}

export interface EventoEntity {
  id: string;
  eventoPadreId: string;
  tipoEvento: number;
  codigoEvento: number;
  anio: string;
  estado: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  imagen: string | null;
  flgActivo: boolean;
  flgVisible: boolean;
  eventoPadre?: EventoPadreEntity;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GessStandEntity {
  id: string;
  eventoId: string;
  standApiId: string;
  standCode: string;
  tipoStand: string | null;
  medidas: string | null;
  estado: string | null;
  empresa: string | null;
  bloqueId: string | null;
  rawData: unknown;
}

export interface RoleEntity {
  id: string;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
  usuarios: UserRoleEntity[];
}

export interface UserRoleEntity {
  id: string;
  userId: string;
  email: string;
  roleId: string;
}

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  roles: Rol[];
  permissions: string[];
  eventoId?: string;
  eventoPadreId?: string;
}
