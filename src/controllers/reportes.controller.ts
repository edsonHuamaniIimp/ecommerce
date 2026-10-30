import { NextResponse } from "next/server";
import { success, error } from "@/lib/server/api-response";
import { getSession } from "@/lib/server/auth";
import { services } from "@/lib/server/services";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { construirExcelReporte } from "@/lib/server/reportes-excel";

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

  async empresasPorPais(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const params = new URL(request.url).searchParams;
    const eventoId = params.get("eventoId")?.trim() || undefined;
    const incluirInactivas = params.get("incluirInactivas") === "1";

    const data = await services.reportesSolicitudes.empresasPorPais(
      { eventoId, incluirInactivas },
      session.permissions,
    );
    return success({ data });
  },

  async mapaPabellones(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const params = new URL(request.url).searchParams;
    const eventoId = params.get("eventoId")?.trim() || undefined;
    const incluirInactivas = params.get("incluirInactivas") === "1";

    const data = await services.reportesSolicitudes.mapaPabellones(
      { eventoId, incluirInactivas },
      session.permissions,
    );
    return success(data);
  },
  async exportar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const params = new URL(request.url).searchParams;
    const eventoId = params.get("eventoId")?.trim() || undefined;
    const incluirInactivas = params.get("incluirInactivas") === "1";
    const generadoEn = new Date();

    const data = await services.reportesSolicitudes.exportacion(
      { eventoId, incluirInactivas },
      session.permissions,
    );
    const archivo = await construirExcelReporte(data, { eventoId, incluirInactivas, generadoEn });
    const fecha = generadoEn.toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(archivo), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="reporte-solicitudes-${fecha}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  },

};
