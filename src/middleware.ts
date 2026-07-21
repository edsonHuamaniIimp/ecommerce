import { type NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken, hasRole } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

const PROTECTED: { path: string; roles: string[] }[] = [
  { path: "/dashboard/gess", roles: [ROLES.ADMIN] },
  { path: "/dashboard/roles", roles: [ROLES.ADMIN] },
  { path: "/dashboard/eventos", roles: [ROLES.ADMIN] },
  { path: "/api/roles", roles: [ROLES.ADMIN] },
  { path: "/api/eventos", roles: [ROLES.ADMIN] },
  { path: "/dashboard", roles: [ROLES.ADMIN, ROLES.LOGISTICA, ROLES.LEGAL, ROLES.COMUNICACION] },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/auth/login" || pathname === "/presala" || pathname.startsWith("/api/auth/") || pathname === "/api/eventos/presala") {
    return NextResponse.next();
  }

  for (const route of PROTECTED) {
    if (pathname.startsWith(route.path)) {
      const token = getTokenFromRequest(request);
      if (!token) return redirectToLogin(request);
      const payload = await verifyToken(token);
      if (!payload) return redirectToLogin(request);
      if (!hasRole(payload, ...(route.roles as typeof ROLES[keyof typeof ROLES][]))) {
        return NextResponse.redirect(new URL("/403", request.url));
      }
      if (payload.roles.includes(ROLES.ADMIN)) break;
      if (!payload.eventoId) {
        return NextResponse.redirect(new URL("/presala", request.url));
      }
      break;
    }
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("returnTo", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
