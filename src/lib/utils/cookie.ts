import { NextResponse } from "next/server";

const TOKEN_COOKIE = "token";

const COOKIE_DEFAULTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
} as const;

const COOKIE_MAX_AGE = 24 * 60 * 60; // 24h

export function setTokenCookie(res: NextResponse, token: string): void {
  res.cookies.set(TOKEN_COOKIE, token, { ...COOKIE_DEFAULTS, maxAge: COOKIE_MAX_AGE });
}

export function clearTokenCookie(res: NextResponse): void {
  res.cookies.set(TOKEN_COOKIE, "", { ...COOKIE_DEFAULTS, maxAge: 0 });
}

export function getTokenFromHeaders(request: Request): string | null {
  return request.headers.get("cookie")?.match(/token=([^;]+)/)?.[1] ?? null;
}
