import 'server-only';

import { NextResponse } from "next/server";
import { SESION } from "@/lib/shared/constants";

const TOKEN_COOKIE = "token";

const COOKIE_DEFAULTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
} as const;

export function setTokenCookie(
  res: NextResponse,
  token: string,
  maxAge: number = SESION.MAX_AGE_ESTANDAR,
): void {
  res.cookies.set(TOKEN_COOKIE, token, { ...COOKIE_DEFAULTS, maxAge });
}

export function clearTokenCookie(res: NextResponse): void {
  res.cookies.set(TOKEN_COOKIE, "", { ...COOKIE_DEFAULTS, maxAge: 0 });
}

export function getTokenFromHeaders(request: Request): string | null {
  return request.headers.get("cookie")?.match(/token=([^;]+)/)?.[1] ?? null;
}
