import { type NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken, hasPermission } from "@/lib/server/auth";
import { PUBLIC_ROUTES, PUBLIC_API_PREFIXES, PUBLIC_API_ROUTES } from "@/lib/shared/constants";

interface ProtectedRoute {
  /** Prefijo de ruta (startsWith) */
  path: string;
  /** Permiso requerido. Si se omite, cualquier rol autenticado accede. */
  permission?: string;
}

const PROTECTED: ProtectedRoute[] = [
  { path: "/dashboard/vinculacion", permission: "stands:vinculacion" },
  { path: "/dashboard/datos-evento", permission: "eventos:datos" },
  { path: "/dashboard/solicitudes", permission: "solicitudes:view" },
  { path: "/dashboard/mis-solicitudes", permission: "solicitudes:view" },
  { path: "/dashboard/stands", permission: "stands:manage" },
  { path: "/dashboard/reservas", permission: "read:reservas" },
  { path: "/dashboard/auspicios", permission: "auspicios:view" },
  { path: "/dashboard/facturacion", permission: "facturacion:view" },
  { path: "/api/facturacion", permission: "facturacion:view" },
  { path: "/dashboard/laboratorio", permission: "laboratorio:view" },
  { path: "/api/planos", permission: "laboratorio:view" },
  { path: "/dashboard/roles", permission: "roles:manage" },
  { path: "/dashboard/eventos", permission: "events:manage" },
  { path: "/api/roles", permission: "roles:manage" },
  { path: "/api/eventos", permission: "events:manage" },
  { path: "/api/solicitudes", permission: "solicitudes:view" },
  { path: "/api/auspicios", permission: "auspicios:view" },
  { path: "/api/entidades" },
  { path: "/api/exhibidoras" },
  { path: "/api/alertas" },
  { path: "/plano", permission: "stands:plano" },
  { path: "/mapa", permission: "stands:plano" },
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
      if (payload.roles.includes("admin")) break;

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
