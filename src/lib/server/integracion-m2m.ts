import 'server-only';

const IS_LOCAL = process.env.NODE_ENV !== "production";

/**
 * Validacion M2M para endpoints de integracion (Sistema de Montaje).
 * El consumidor envia el header x-api-key con la clave compartida.
 * En ambiente local (desarrollo) se permite consumo directo sin clave.
 */
export function validarIntegracionM2M(request: Request): boolean {
  if (IS_LOCAL) return true;
  const clave = process.env.INTEGRACION_API_KEY;
  if (!clave) return false;
  const enviada = request.headers.get("x-api-key");
  return enviada === clave;
}

export interface AutorizacionIntegracion {
  /** Hay clave M2M valida o sesion autenticada. */
  ok: boolean;
  origen: "m2m" | "sesion";
  /** La sesion tiene permiso amplio (gestiona todo); si es false, el caller debe validar propiedad. */
  esStaff: boolean;
  email: string | null;
  userId: string | null;
  permissions: string[];
}

/**
 * Autoriza un endpoint de integracion que tambien se usa desde la UI:
 * acepta la clave M2M (`x-api-key`) o una sesion autenticada.
 * `permission` marca cuando la sesion es "staff" (acceso amplio); para sesiones
 * sin ese permiso (p. ej. cliente) el caller debe validar la propiedad del recurso.
 */
export async function autorizarIntegracion(request: Request, permission: string): Promise<AutorizacionIntegracion> {
  if (validarIntegracionM2M(request)) {
    return { ok: true, origen: "m2m", esStaff: true, email: null, userId: null, permissions: [] };
  }

  const { getSession } = await import("@/lib/server/auth");
  const { PERMISSIONS } = await import("@/lib/shared/constants");
  const session = await getSession();
  if (!session) {
    return { ok: false, origen: "sesion", esStaff: false, email: null, userId: null, permissions: [] };
  }
  const esStaff = session.permissions.includes(permission) || session.permissions.includes(PERMISSIONS.ADMIN_FULL);
  return { ok: true, origen: "sesion", esStaff, email: session.email, userId: session.sub, permissions: session.permissions };
}
