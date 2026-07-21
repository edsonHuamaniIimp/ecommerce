import { SignJWT, jwtVerify } from "jose";
import { ROLES, ROLES_PERMISSIONS } from "@/lib/constants";
import type { Rol } from "@/lib/constants";
import type { NextRequest } from "next/server";

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
}

export async function signToken(payload: Omit<JwtPayload, "permissions"> & {
  permissions?: string[];
  eventoId?: string;
  eventoPadreId?: string;
}): Promise<string> {
  const permissions = payload.roles.flatMap((r) => ROLES_PERMISSIONS[r] ?? []);
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
