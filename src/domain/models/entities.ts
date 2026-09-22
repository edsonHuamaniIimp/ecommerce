import type { Rol } from "@/lib/shared/constants";

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
  plano: string;
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
  email: string | null;
  userId: string | null;
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

export interface RevisionEntity {
  id: string;
  solicitudId: string;
  area: string;
  estado: string;
  comentario: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  fuePrimeraRevision: boolean;
}

export interface ReevaluacionEntity {
  id: string;
  solicitudId: string;
  estado: string;
  motivo: string | null;
  documentos: unknown;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RevisionHistorialEntity {
  id: string;
  solicitudId: string;
  area: string;
  estadoAnterior: string;
  comentarioAnterior: string | null;
  motivo: string;
  createdBy: string | null;
  createdAt: Date;
}

export interface SolicitudRow {
  id: string;
  gessStandId: string | null;
  standCode: string;
  standCodes: string[];
  tipoStand: string | null;
  medidas: string | null;
  empresa: string | null;
  email: string | null;
  userId: string | null;
  bloqueId: string | null;
  estado: string | null;
  estadoSolicitud: string;
  flgActivo: boolean;
  documentos: unknown;
  imagenes: unknown;
  docsAdjuntosCount: number;
  clienteDocsAdjuntosCount: number;
  docsAdjuntos: Array<{ id: string; url: string; nombre: string; userId: string | null; uploadedBy: string | null; createdAt: Date }>;
  updatedAt: Date;
  revisiones: RevisionEntity[];
  reevaluaciones: ReevaluacionEntity[];
  revisionComunicacion: RevisionEntity | null;
  revisionLegal: RevisionEntity | null;
  revisionLogistica: RevisionEntity | null;
  tieneFacturacion: boolean;
  tipoFacturacion: string | null;
  facturacionId: string | null;
  /** Estado del expediente en el SGC (null = no aplica / aun sin expediente). */
  sgcEstadoEnvio: string | null;
  sgcLifecycleStatus: string | null;
  sgcStage: string | null;
  /** True si la integracion SGC esta habilitada (SGC_ENABLED=1) en el servidor. */
  sgcEnabled: boolean;
}
