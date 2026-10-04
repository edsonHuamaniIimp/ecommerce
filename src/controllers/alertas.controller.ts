import { NextResponse } from "next/server";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { getSession } from "@/lib/server/auth";
import { services } from "@/lib/server/services";

export const alertasController = {
  async listar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const url = new URL(request.url);
    const soloNoLeidas = url.searchParams.get("no_leidas") === "1";

    const data = await services.alertas.listar(session, soloNoLeidas);
    return success(data);
  },

  async marcarLeida(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const raw = await request.json() as { id: string };
    await services.alertas.marcarLeida(session, raw.id);
    return success({ ok: true });
  },

  async marcarTodasLeidas(_request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    await services.alertas.marcarTodasLeidas(session);
    return success({ ok: true });
  },
};
