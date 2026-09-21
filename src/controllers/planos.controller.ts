import type { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES, PERMISSIONS } from "@/lib/shared/constants";
import { getSession } from "@/lib/server/auth";
import { planoCrearSchema, planoMetaSchema, planoLayoutSchema, planoImportarSchema, planoSeccionesSchema } from "@/validators/planos.validator";

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { err: error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401) };
  if (!session.permissions.includes(PERMISSIONS.LABORATORIO_MANAGE) && !session.permissions.includes(PERMISSIONS.ADMIN_FULL)) {
    return { err: error(API_ERROR_CODES.FORBIDDEN, "Sin permisos de laboratorio", 403) };
  }
  return { session };
}

export const planosController = {
  async listar(): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    return success(await services.planos.listar());
  },

  async detalle(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const codigo = url.searchParams.get("codigo");
    if (codigo) {
      const plano = await services.planos.detallePorCodigo(codigo);
      if (!plano) return error(API_ERROR_CODES.NOT_FOUND, "Plano no encontrado", 404);
      return success(plano);
    }
    if (!id) return error(API_ERROR_CODES.VALIDATION, "id o codigo requerido", 400);
    return success(await services.planos.detalle(id));
  },

  async planosDeEvento(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const url = new URL(request.url);
    const tipoEvento = Number(url.searchParams.get("tipoEvento"));
    const codigoEvento = Number(url.searchParams.get("codigoEvento"));
    if (!tipoEvento || !codigoEvento) return error(API_ERROR_CODES.VALIDATION, "tipoEvento y codigoEvento requeridos", 400);
    return success(await services.planos.planosDeEvento(tipoEvento, codigoEvento));
  },

  async crear(request: Request): Promise<NextResponse> {
    const auth = await requireAdmin();
    if ("err" in auth && auth.err) return auth.err;
    const body = planoCrearSchema.parse(await request.json());
    return success(await services.planos.crear(body));
  },

  async actualizarMeta(request: Request): Promise<NextResponse> {
    const auth = await requireAdmin();
    if ("err" in auth && auth.err) return auth.err;
    const body = planoMetaSchema.parse(await request.json());
    const { id, ...data } = body;
    return success(await services.planos.actualizarMeta(id, data));
  },

  async guardarLayout(request: Request): Promise<NextResponse> {
    const auth = await requireAdmin();
    if ("err" in auth && auth.err) return auth.err;
    const body = planoLayoutSchema.parse(await request.json());
    const { id, ...data } = body;
    return success(await services.planos.guardarLayout(id, {
      tipos: data.tipos,
      bloques: data.bloques.map((b) => ({ ...b, tipologia: b.tipologia ?? null })),
      furniture: data.furniture.map((f) => ({ ...f, config: f.config ?? null })),
    }));
  },

  async eliminar(request: Request): Promise<NextResponse> {
    const auth = await requireAdmin();
    if ("err" in auth && auth.err) return auth.err;
    const { id } = (await request.json()) as { id: string };
    if (!id) return error(API_ERROR_CODES.VALIDATION, "id requerido", 400);
    await services.planos.eliminar(id);
    return success({ ok: true });
  },

  async exportar(request: Request): Promise<NextResponse> {
    const auth = await requireAdmin();
    if ("err" in auth && auth.err) return auth.err;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return error(API_ERROR_CODES.VALIDATION, "id requerido", 400);
    return success(await services.planos.exportar(id));
  },

  async exportarTs(request: Request): Promise<NextResponse> {
    const auth = await requireAdmin();
    if ("err" in auth && auth.err) return auth.err;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return error(API_ERROR_CODES.VALIDATION, "id requerido", 400);
    return success(await services.planos.exportarTypeScript(id));
  },

  async importar(request: Request): Promise<NextResponse> {
    const auth = await requireAdmin();
    if ("err" in auth && auth.err) return auth.err;
    const body = planoImportarSchema.parse(await request.json());
    return success(await services.planos.importar(body as never));
  },

  async guardarSecciones(request: Request): Promise<NextResponse> {
    const auth = await requireAdmin();
    if ("err" in auth && auth.err) return auth.err;
    const body = planoSeccionesSchema.parse(await request.json());
    const { id, secciones } = body;
    return success(await services.planos.guardarSecciones(id, secciones.map((s) => ({ ...s, planoHijoId: s.planoHijoId ?? null }))));
  },

  async macrosDePlano(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const planoId = new URL(request.url).searchParams.get("planoId");
    if (!planoId) return error(API_ERROR_CODES.VALIDATION, "planoId requerido", 400);
    return success(await services.planos.macrosQueContienen(planoId));
  },

  async asignarAMacro(request: Request): Promise<NextResponse> {
    const auth = await requireAdmin();
    if ("err" in auth && auth.err) return auth.err;
    const { macroId, planoId } = (await request.json()) as { macroId: string; planoId: string };
    if (!macroId || !planoId) return error(API_ERROR_CODES.VALIDATION, "macroId y planoId requeridos", 400);
    return success(await services.planos.asignarAMacro(macroId, planoId));
  },

  async quitarDeMacros(request: Request): Promise<NextResponse> {
    const auth = await requireAdmin();
    if ("err" in auth && auth.err) return auth.err;
    const { planoId } = (await request.json()) as { planoId: string };
    if (!planoId) return error(API_ERROR_CODES.VALIDATION, "planoId requerido", 400);
    await services.planos.quitarDeMacros(planoId);
    return success({ ok: true });
  },

  async ocupacion(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const eventoId = url.searchParams.get("eventoId");
    if (!id || !eventoId) return error(API_ERROR_CODES.VALIDATION, "id y eventoId requeridos", 400);
    return success(await services.planos.ocupacion(id, eventoId));
  },
};
