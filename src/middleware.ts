import { type NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken, hasRole, hasPermission } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

const PROTECTED: { path: string; roles: string[]; permission?: string }[] = [
  { path: "/dashboard/vinculacion", roles: [ROLES.ADMIN], permission: "stands:vinculacion" },
  { path: "/dashboard/datos-evento", roles: [ROLES.ADMIN, ROLES.LOGISTICA, ROLES.LEGAL, ROLES.COMUNICACION, ROLES.CLIENTE], permission: "eventos:datos" },
  { path: "/dashboard/solicitudes", roles: [ROLES.ADMIN, ROLES.LOGISTICA, ROLES.LEGAL, ROLES.COMUNICACION, ROLES.CLIENTE], permission: "solicitudes:view" },
  { path: "/dashboard/mis-solicitudes", roles: [ROLES.ADMIN, ROLES.LOGISTICA, ROLES.LEGAL, ROLES.COMUNICACION, ROLES.CLIENTE], permission: "solicitudes:view" },
  { path: "/dashboard/stands", roles: [ROLES.ADMIN, ROLES.LOGISTICA, ROLES.LEGAL, ROLES.COMUNICACION], permission: "stands:manage" },
  { path: "/dashboard/reservas", roles: [ROLES.ADMIN, ROLES.LOGISTICA, ROLES.LEGAL, ROLES.COMUNICACION, ROLES.CLIENTE], permission: "read:reservas" },
  { path: "/dashboard/auspicios", roles: [ROLES.ADMIN, ROLES.LOGISTICA, ROLES.LEGAL, ROLES.COMUNICACION, ROLES.CLIENTE], permission: "auspicios:view" },
  { path: "/api/auspicios", roles: [ROLES.ADMIN, ROLES.LOGISTICA, ROLES.LEGAL, ROLES.COMUNICACION, ROLES.CLIENTE], permission: "auspicios:view" },
  { path: "/dashboard/roles", roles: [ROLES.ADMIN], permission: "roles:manage" },
  { path: "/dashboard/eventos", roles: [ROLES.ADMIN], permission: "events:manage" },
  { path: "/api/roles", roles: [ROLES.ADMIN], permission: "roles:manage" },
  { path: "/api/eventos", roles: [ROLES.ADMIN], permission: "events:manage" },
  { path: "/api/solicitudes", roles: [ROLES.ADMIN, ROLES.LOGISTICA, ROLES.LEGAL, ROLES.COMUNICACION, ROLES.CLIENTE], permission: "solicitudes:view" },
  { path: "/api/alertas", roles: [ROLES.ADMIN, ROLES.LOGISTICA, ROLES.LEGAL, ROLES.COMUNICACION, ROLES.CLIENTE], permission: "dashboard:view" },
  { path: "/plano", roles: [ROLES.ADMIN, ROLES.LOGISTICA, ROLES.LEGAL, ROLES.COMUNICACION, ROLES.CLIENTE], permission: "stands:plano" },
  { path: "/dashboard", roles: [ROLES.ADMIN, ROLES.LOGISTICA, ROLES.LEGAL, ROLES.COMUNICACION, ROLES.CLIENTE] },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/auth/login" || pathname === "/presala" || pathname === "/" || pathname.startsWith("/api/auth/") || pathname === "/api/maestra" || (pathname === "/api/eventos/listar" && request.nextUrl.searchParams.get("presala") === "1") || pathname.startsWith("/api/maestra/")) {
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
      if (route.permission && !hasPermission(payload, route.permission)) {
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
  const returnTo = request.nextUrl.pathname + request.nextUrl.search;
  loginUrl.searchParams.set("returnTo", returnTo);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
