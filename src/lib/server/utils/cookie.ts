import 'server-only';

import { NextResponse } from "next/server";
import { IDIOMA_COOKIE, SESION } from "@/lib/shared/constants";

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

const IDIOMA_MAX_AGE = 365 * 24 * 60 * 60; // 1 anio

/**
 * Cookie con la preferencia de idioma (`iimp_idioma`). No es httpOnly: el selector
 * del cliente la sincroniza con la cookie `googtrans` de Google Translate.
 */
export function setIdiomaCookie(res: NextResponse, idioma: string): void {
  res.cookies.set(IDIOMA_COOKIE, idioma, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: IDIOMA_MAX_AGE,
  });
}
