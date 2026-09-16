import 'server-only';

import { SignJWT, jwtVerify } from "jose";
import { ROLES, ROLES_PERMISSIONS } from "../shared/constants";
import type { Rol } from "../shared/constants";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret-cambiar-en-produccion");
const ISSUER = "contratos-stands";
const AUDIENCE = "contratos-stands-api";

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  roles: Rol[];
  permissions: string[];
  eventoId?: string;
  eventoPadreId?: string;
  tipoEvento?: number;
  codigoEvento?: number;
  eventoNombre?: string;
  eventoPadreNombre?: string;
}

export async function signToken(payload: Omit<JwtPayload, "permissions"> & {
  permissions?: string[];
}): Promise<string> {
  const permissions = payload.permissions && payload.permissions.length > 0
    ? payload.permissions
    : payload.roles.flatMap((r) => ROLES_PERMISSIONS[r] ?? []);
  const tokenPayload: Record<string, unknown> = { ...payload, permissions };
  return new SignJWT(tokenPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);

  const cookie = request.cookies.get("token");
  if (cookie?.value) return cookie.value;

  return null;
}

export function hasRole(payload: JwtPayload, ...roles: Rol[]): boolean {
  return roles.some((r) => payload.roles.includes(r));
}

export function hasPermission(payload: JwtPayload, permission: string): boolean {
  return payload.permissions.includes(permission) || payload.roles.includes(ROLES.ADMIN);
}

/**
 * Valida un permiso contra la base de datos (fuente de verdad).
 * Usar en endpoints criticos donde el JWT puede estar desactualizado.
 * El admin siempre tiene acceso.
 */
export async function hasDBPermission(session: JwtPayload, permission: string): Promise<boolean> {
  if (session.roles.includes(ROLES.ADMIN)) return true;
  try {
    const { prisma } = await import("./db");
    const userRole = await prisma.userRole.findFirst({
      where: { userId: session.sub },
      select: { role: { select: { permisos: true } } },
    });
    return userRole?.role.permisos.includes(permission) ?? false;
  } catch {
    return false;
  }
}

export async function getSession(): Promise<JwtPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}
