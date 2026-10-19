/** Regla de acceso del proxy (misma forma que `ProtectedRoute`). */
export interface ReglaAccesoRuta {
  permission?: string;
  anyOf?: readonly string[];
}

/**
 * True si el usuario puede pasar el proxy para la ruta:
 * - `anyOf`: basta con tener uno de los permisos (APIs compartidas staff/cliente);
 * - `permission`: exige ese permiso;
 * - sin ninguno: cualquier sesion autenticada.
 */
export function tieneAccesoRuta(regla: ReglaAccesoRuta, permisos: readonly string[]): boolean {
  if (regla.anyOf && regla.anyOf.length > 0) {
    return regla.anyOf.some((permiso) => permisos.includes(permiso));
  }
  return !regla.permission || permisos.includes(regla.permission);
}