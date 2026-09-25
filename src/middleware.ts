import { type NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken, hasPermission } from "@/lib/server/auth";
import { PUBLIC_ROUTES, PUBLIC_API_PREFIXES, PUBLIC_API_ROUTES, PERMISSIONS, ROLES } from "@/lib/shared/constants";

interface ProtectedRoute {
  /** Prefijo de ruta (startsWith) */
  path: string;
  /** Permiso requerido. Si se omite, cualquier rol autenticado accede. */
  permission?: string;
}

const PROTECTED: ProtectedRoute[] = [
  { path: "/dashboard/vinculacion", permission: PERMISSIONS.STANDS_VINCULACION },
  { path: "/dashboard/datos-evento", permission: PERMISSIONS.EVENTOS_DATOS },
  { path: "/dashboard/solicitudes", permission: PERMISSIONS.SOLICITUDES_VIEW },
  { path: "/dashboard/mis-solicitudes", permission: PERMISSIONS.SOLICITUDES_VIEW },
  { path: "/dashboard/stands", permission: PERMISSIONS.STANDS_MANAGE },
  { path: "/dashboard/reservas", permission: PERMISSIONS.READ_RESERVAS },
  { path: "/dashboard/auspicios", permission: PERMISSIONS.AUSPICIOS_VIEW },
  { path: "/dashboard/facturacion", permission: PERMISSIONS.FACTURACION_VIEW },
  { path: "/api/facturacion", permission: PERMISSIONS.FACTURACION_VIEW },
  { path: "/dashboard/laboratorio", permission: PERMISSIONS.LABORATORIO_VIEW },
  { path: "/api/planos", permission: PERMISSIONS.LABORATORIO_VIEW },
  { path: "/dashboard/roles", permission: PERMISSIONS.ROLES_MANAGE },
  { path: "/dashboard/eventos", permission: PERMISSIONS.EVENTS_MANAGE },
  { path: "/api/roles", permission: PERMISSIONS.ROLES_MANAGE },
  { path: "/api/solicitudes-cuenta", permission: PERMISSIONS.ROLES_MANAGE },
  { path: "/api/dashboard" },
  { path: "/api/eventos", permission: PERMISSIONS.EVENTS_MANAGE },
  { path: "/api/solicitudes", permission: PERMISSIONS.SOLICITUDES_VIEW },
  { path: "/api/sgc", permission: PERMISSIONS.SOLICITUDES_VIEW },
  { path: "/api/auspicios", permission: PERMISSIONS.AUSPICIOS_VIEW },
  { path: "/api/entidades" },
  { path: "/api/exhibidoras" },
  { path: "/api/alertas" },
  { path: "/plano", permission: PERMISSIONS.STANDS_PLANO },
  { path: "/dashboard" },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.some(r => r === pathname);
  const isPublicApiPrefix = PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p));
  const isPublicApiExact = PUBLIC_API_ROUTES.some(r => r === pathname);
  const isPresalaListar = pathname === "/api/eventos/listar" && request.nextUrl.searchParams.get("presala") === "1";

  if (isPublicRoute || isPublicApiPrefix || isPublicApiExact || isPresalaListar) {
    return NextResponse.next();
  }

  for (const route of PROTECTED) {
    if (pathname.startsWith(route.path)) {
      const token = getTokenFromRequest(request);
      if (!token) return redirectToLogin(request);

      const payload = await verifyToken(token);
      if (!payload) return redirectToLogin(request);

      if (route.permission && !hasPermission(payload, route.permission)) {
        return NextResponse.redirect(new URL("/403", request.url));
      }

      // Admin bypass eventoId check
      if (payload.roles.includes(ROLES.ADMIN)) break;

      if (!payload.eventoId) {
        /*
         * Sin evento en el token: manda a elegirlo. `change=1` hace que /presala muestre
         * el selector en vez de rebotar a /dashboard (evita el ciclo presala <-> dashboard).
         */
        const presala = new URL("/presala", request.url);
        presala.searchParams.set("change", "1");
        presala.searchParams.set("returnTo", pathname);
        return NextResponse.redirect(presala);
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
