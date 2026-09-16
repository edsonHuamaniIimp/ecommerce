import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { updateGessStandSchema } from "@/validators/gess.validator";

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
    const raw = await request.json();
    const body = updateGessStandSchema.parse(raw);
    return success(await services.gess.actualizarStand(body.id, body));
  },

  async sync(request: Request): Promise<NextResponse> {
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
