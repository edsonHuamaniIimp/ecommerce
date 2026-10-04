import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES, PERMISSIONS } from "@/lib/shared/constants";
import { getSession } from "@/lib/server/auth";
import { updateGessStandSchema } from "@/validators/gess.validator";
import { guardarTipoStandImagenSchema } from "@/validators/tipos-stand.validator";

/** Guarda de escritura de stands: sesion + `stands:manage` (el admin pasa por `admin:full`). */
async function autorizarEscrituraStands(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
  if (!session.permissions.includes(PERMISSIONS.STANDS_MANAGE) && !session.permissions.includes(PERMISSIONS.ADMIN_FULL)) {
    return error(API_ERROR_CODES.FORBIDDEN, "Sin permisos para gestionar stands", 403);
  }
  return null;
}

export const gessController = {
  async listar(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const eventoId = searchParams.get("eventoId");
    const bloqueId = searchParams.get("bloqueId");

    if (bloqueId) {
      return success(await services.gess.findByBloque(bloqueId));
    }

    if (!eventoId) {
      return error(API_ERROR_CODES.VALIDATION, "eventoId es requerido", 400);
    }

    const page = Number(searchParams.get("page") || 1);
    const perPage = Number(searchParams.get("per_page") || 10);
    const search = searchParams.get("search") ?? undefined;
    const estado = searchParams.get("estado") ?? undefined;

    const result = await services.gess.listar(eventoId, { page, perPage, search, estado });
    return NextResponse.json({
      data: result.data,
      pagination: { page: result.page, per_page: result.perPage, total: result.total, total_pages: result.totalPages },
    });
  },

  async actualizar(request: Request): Promise<NextResponse> {
    const noAutorizado = await autorizarEscrituraStands();
    if (noAutorizado) return noAutorizado;
    const raw = await request.json();
    const body = updateGessStandSchema.parse(raw);
    return success(await services.gess.actualizarStand(body.id, body));
  },

  /** Catalogo de imagenes referenciales por tipo de stand del evento (RF-08, admin). */
  async tiposImagenListar(): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    services.tiposStandImagen.autorizarGestion(session.permissions);
    return success(await services.tiposStandImagen.listar(session.eventoId ?? null));
  },

  /** Sube/reemplaza la imagen referencial de un tipo de stand (aplica a todos sus stands). */
  async tiposImagenGuardar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    services.tiposStandImagen.autorizarGestion(session.permissions);
    const parsed = guardarTipoStandImagenSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    await services.tiposStandImagen.guardar(parsed.data.tipo, parsed.data.imagenUrl, session.eventoId ?? null);
    return success({ ok: true });
  },

  /** Quita la imagen referencial de un tipo de stand. */
  async tiposImagenEliminar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    services.tiposStandImagen.autorizarGestion(session.permissions);
    const tipo = new URL(request.url).searchParams.get("tipo");
    if (!tipo) return error(API_ERROR_CODES.VALIDATION, "tipo requerido", 400);
    await services.tiposStandImagen.eliminar(tipo, session.eventoId ?? null);
    return success({ ok: true });
  },

  async sync(request: Request): Promise<NextResponse> {
    /* Publico por diseno: el mapa sincroniza stands del plano en la primera carga.
       Solo crea los faltantes; no resetea estados (eso es `mockup`, que si esta protegido). */
    const body = await request.json() as {
      tipoEvento?: number; codigoEvento?: number; eventoId?: string;
      seleccionadas?: Record<string, unknown>[];
    };
    if (!body.eventoId) {
      return error(API_ERROR_CODES.VALIDATION, "eventoId es requerido", 400);
    }
    return success(await services.gess.sync(body.eventoId, body.tipoEvento ?? 0, body.codigoEvento ?? 0, body.seleccionadas));
  },

  async mockup(request: Request): Promise<NextResponse> {
    const noAutorizado = await autorizarEscrituraStands();
    if (noAutorizado) return noAutorizado;
    const body = await request.json() as { tipoEvento?: number; codigoEvento?: number; eventoId?: string };
    if (!body.eventoId) {
      return error(API_ERROR_CODES.VALIDATION, "eventoId es requerido", 400);
    }
    if (body.tipoEvento === undefined || body.codigoEvento === undefined) {
      return error(API_ERROR_CODES.VALIDATION, "tipoEvento y codigoEvento son requeridos", 400);
    }
    return success(await services.gess.mockup(body.eventoId, body.tipoEvento, body.codigoEvento));
  },
};
