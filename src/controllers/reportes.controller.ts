import type { NextResponse } from "next/server";
import { success, error } from "@/lib/server/api-response";
import { getSession } from "@/lib/server/auth";
import { services } from "@/lib/server/services";
import { API_ERROR_CODES } from "@/lib/shared/constants";

export const reportesController = {
  async solicitudesPorPais(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const params = new URL(request.url).searchParams;
    const eventoId = params.get("eventoId")?.trim() || undefined;
    const incluirInactivas = params.get("incluirInactivas") === "1";

    const data = await services.reportesSolicitudes.resumenPorPais(
      { eventoId, incluirInactivas },
      session.permissions,
    );
    return success({ data });
  },
};
