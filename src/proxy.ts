import { type NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken, estadoAcceso } from "@/lib/server/auth";
import { tieneAccesoRuta } from "@/lib/shared/utils/proxy-acceso";
import { PUBLIC_ROUTES, PUBLIC_API_PREFIXES, PUBLIC_API_ROUTES, PERMISSIONS, ROLES, RUTAS_PERMITIDAS_CAMBIO_PASSWORD, RUTAS_PERMITIDAS_VALIDAR_DATOS, DD_RUTAS, API_SOLICITUDES_PERMISOS, API_SGC_PERMISOS } from "@/lib/shared/constants";

interface ProtectedRoute {
  /** Prefijo de ruta (startsWith) */
  path: string;
  /** Permiso requerido. Si se omite, cualquier rol autenticado accede. */
  permission?: string;
  /** Alternativa: basta con tener UNO de estos permisos (APIs compartidas staff/cliente). */
  anyOf?: readonly string[];
}

const PROTECTED: ProtectedRoute[] = [
  { path: "/dashboard/vinculacion", permission: PERMISSIONS.STANDS_VINCULACION },
  { path: "/dashboard/datos-evento", permission: PERMISSIONS.EVENTOS_DATOS },
  { path: "/dashboard/solicitudes", permission: PERMISSIONS.SOLICITUDES_GESTION },
  { path: "/dashboard/mis-solicitudes", permission: PERMISSIONS.MIS_RESERVAS_VIEW },
  { path: "/dashboard/mis-pagos", permission: PERMISSIONS.PAGOS_VIEW },
  { path: "/api/pagos", permission: PERMISSIONS.PAGOS_VIEW },
  { path: "/dashboard/stands", permission: PERMISSIONS.STANDS_MANAGE },
  { path: "/dashboard/pre-reservas", permission: PERMISSIONS.STANDS_PRE_RESERVAR },
  { path: "/dashboard/reservas", permission: PERMISSIONS.READ_RESERVAS },
  { path: "/dashboard/auspicios", permission: PERMISSIONS.AUSPICIOS_VIEW },
  { path: "/dashboard/facturacion", permission: PERMISSIONS.FACTURACION_VIEW },
  { path: "/api/facturacion", permission: PERMISSIONS.FACTURACION_VIEW },
  { path: "/dashboard/laboratorio", permission: PERMISSIONS.LABORATORIO_VIEW },
  { path: "/api/planos", permission: PERMISSIONS.LABORATORIO_VIEW },
  { path: "/dashboard/roles", permission: PERMISSIONS.ROLES_MANAGE },
  { path: "/dashboard/usuarios", permission: PERMISSIONS.USUARIOS_MANAGE },
  { path: "/api/usuarios", permission: PERMISSIONS.USUARIOS_MANAGE },
  { path: "/dashboard/eventos", permission: PERMISSIONS.EVENTS_MANAGE },
  { path: "/dashboard/configuracion", permission: PERMISSIONS.PORTAL_MANAGE },
  /* Debida Diligencia: permisos propios del modulo (dd:*). */
  { path: DD_RUTAS.BANDEJA, permission: PERMISSIONS.DD_REVISION },
  { path: DD_RUTAS.MATRIZ, permission: PERMISSIONS.DD_MATRIZ },
  { path: DD_RUTAS.LEGAL, permission: PERMISSIONS.DD_LEGAL },
  { path: DD_RUTAS.REPUTACION, permission: PERMISSIONS.DD_REPUTACION },
  { path: DD_RUTAS.FORMULARIO, permission: PERMISSIONS.DD_FORMULARIO },
  { path: DD_RUTAS.BASE },
  /* Empresas (Portal del Cliente). El prefijo exacto de montajistas va primero para no
     quedar capturado por `/api/empresas` (catalogo SIE usado tambien por clientes). */
  { path: "/api/empresas-montajistas" },
  { path: "/dashboard/empresas", permission: PERMISSIONS.EMPRESAS_VIEW },
  { path: "/api/empresas", permission: PERMISSIONS.EMPRESAS_VIEW },
  { path: "/api/roles", permission: PERMISSIONS.ROLES_MANAGE },
  { path: "/api/solicitudes-cuenta", permission: PERMISSIONS.ROLES_MANAGE },
  { path: "/api/dashboard" },
  { path: "/api/eventos/crear", permission: PERMISSIONS.EVENTS_CREATE },
  { path: "/api/eventos/actualizar", permission: PERMISSIONS.EVENTS_EDIT },
  { path: "/api/eventos", permission: PERMISSIONS.EVENTS_MANAGE },
  /* API compartida: staff (gestion) y cliente (sus propias solicitudes). El controller aplica scoping/permisos. */
  { path: "/api/solicitudes", anyOf: API_SOLICITUDES_PERMISOS },
  { path: "/api/sgc", anyOf: API_SGC_PERMISOS },
  { path: "/api/auspicios", permission: PERMISSIONS.AUSPICIOS_VIEW },
  { path: "/api/entidades" },
  { path: "/api/exhibidoras" },
  { path: "/api/alertas" },
  { path: "/plano", permission: PERMISSIONS.STANDS_PLANO },
  { path: "/mapa", permission: PERMISSIONS.STANDS_PLANO },
  { path: "/dashboard" },
];

export async function proxy(request: NextRequest) {
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

      /* Cuenta deshabilitada por backoffice: corta la sesion activa de inmediato. */
      const acceso = await estadoAcceso(payload.email);
      if (!acceso.activo) return redirectToLogin(request);

      /* Credencial temporal: solo puede cambiar contrasena/validar datos hasta completarlo. */
      if (
        payload.debeCambiarPassword === true &&
        !(RUTAS_PERMITIDAS_CAMBIO_PASSWORD as readonly string[]).some((p) => pathname.startsWith(p))
      ) {
        return NextResponse.redirect(new URL("/auth/cambiar-password", request.url));
      }

      /*
       * Bloqueo duro del primer ingreso de la empresa (Portal del Cliente): hasta validar
       * sus datos solo puede usar el formulario y las APIs del portal. No aplica a
       * credenciales temporales (esas pasan primero por el cambio de contrasena).
       */
      if (
        payload.debeCambiarPassword !== true &&
        !payload.roles.includes(ROLES.ADMIN) &&
        !(RUTAS_PERMITIDAS_VALIDAR_DATOS as readonly string[]).some((p) => pathname.startsWith(p)) &&
        acceso.validarDatosPendiente
      ) {
        return NextResponse.redirect(new URL("/auth/validar-datos", request.url));
      }

      if (!tieneAccesoRuta(route, payload.permissions)) {
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
