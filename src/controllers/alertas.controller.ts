import { NextResponse } from "next/server";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { getSession } from "@/lib/server/auth";
import { alertasService } from "@/application/alertas/alertas-service";

export const alertasController = {
  async listar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const url = new URL(request.url);
    const soloNoLeidas = url.searchParams.get("no_leidas") === "1";

    const data = await alertasService.listar(session, soloNoLeidas);
    return success(data);
  },

  async marcarLeida(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const raw = await request.json() as { id: string };
    await alertasService.marcarLeida(session, raw.id);
    return success({ ok: true });
  },

  async marcarTodasLeidas(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    await alertasService.marcarTodasLeidas(session);
    return success({ ok: true });
  },
};
