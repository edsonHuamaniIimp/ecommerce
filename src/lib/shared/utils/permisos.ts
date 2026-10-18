import { PERMISSIONS, ROLES } from "@/lib/shared/constants";
import type { SessionDTO } from "@/types/dto/auth/session.dto";

/** Permiso efectivo: el admin (o admin:full) siempre accede. */
export function tienePermiso(
  session: Pick<SessionDTO, "roles" | "permissions"> | null | undefined,
  permiso: string,
): boolean {
  if (!session) return false;
  const roles = session.roles ?? [];
  const permisos = session.permissions ?? [];
  return (
    roles.includes(ROLES.ADMIN) ||
    permisos.includes(PERMISSIONS.ADMIN_FULL) ||
    permisos.includes(permiso)
  );
}

export function esAdmin(session: Pick<SessionDTO, "roles"> | null | undefined): boolean {
  return Boolean(session?.roles?.includes(ROLES.ADMIN));
}
