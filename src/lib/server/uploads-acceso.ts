import "server-only";

import { PERMISSIONS, ROLES } from "@/lib/shared/constants";
import type { ClasificacionArchivoDd } from "@/infrastructure/persistence/dd-archivo-acceso-repository";

/**
 * Proteccion de los documentos de Debida Diligencia servidos por `/uploads/*`.
 *
 * Esta apagada por defecto (`UPLOADS_PROTEGIDOS=true` la enciende): en produccion `/uploads/*`
 * pasa por CloudFront, que solo reenvia la cookie de sesion cuando la politica de cache de ese
 * comportamiento lo indica (variable `proteger_uploads` de Terraform). Activarla antes dejaria
 * sin acceso a los documentos.
 */
export function uploadsProtegidosActivo(): boolean {
  return process.env.UPLOADS_PROTEGIDOS === "true";
}

/** Personal que revisa DD: administracion, SIG/Logistica, Legal, Matriz, Panel y administracion DD. */
const PERMISOS_PERSONAL_DD: string[] = [
  PERMISSIONS.ADMIN_FULL,
  PERMISSIONS.DD_REVISION,
  PERMISSIONS.DD_LEGAL,
  PERMISSIONS.DD_MATRIZ,
  PERMISSIONS.DD_PANEL,
  PERMISSIONS.DD_ADMIN,
];

export interface ContextoAccesoUpload {
  session: { roles: string[]; permissions: string[] } | null;
  /** Llego una clave M2M valida (consumidores de la API de integracion de DD). */
  m2m: boolean;
  /** Empresa del usuario autenticado (solo se consulta cuando hace falta). */
  empresaIdUsuario: string | null;
}

export type DecisionAcceso = { permitido: true } | { permitido: false; status: 401 | 403 };

const esPersonalDd = (session: NonNullable<ContextoAccesoUpload["session"]>): boolean =>
  session.roles.includes(ROLES.ADMIN) || session.permissions.some((p) => PERMISOS_PERSONAL_DD.includes(p));

/**
 * Decide si se entrega un archivo ya clasificado:
 * - `ninguno`: publico, como siempre.
 * - `documento`: personal de DD, la propia empresa o la integracion M2M.
 * - `interno`: solo personal de DD.
 */
export function decidirAccesoUpload(clasificacion: ClasificacionArchivoDd, contexto: ContextoAccesoUpload): DecisionAcceso {
  if (clasificacion.tipo === "ninguno") return { permitido: true };
  if (clasificacion.tipo === "documento" && contexto.m2m) return { permitido: true };
  const { session } = contexto;
  if (!session) return { permitido: false, status: 401 };
  if (esPersonalDd(session)) return { permitido: true };
  if (
    clasificacion.tipo === "documento" &&
    session.permissions.includes(PERMISSIONS.DD_FORMULARIO) &&
    contexto.empresaIdUsuario !== null &&
    clasificacion.empresaIds.includes(contexto.empresaIdUsuario)
  ) {
    return { permitido: true };
  }
  return { permitido: false, status: 403 };
}

/** El cliente solo necesita saber su empresa si el archivo es un documento de empresa y no es personal de DD. */
export function requiereEmpresaDelUsuario(clasificacion: ClasificacionArchivoDd, session: ContextoAccesoUpload["session"]): boolean {
  return clasificacion.tipo === "documento" && session !== null && !esPersonalDd(session);
}
