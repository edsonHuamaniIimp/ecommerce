import { NextResponse } from "next/server";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { validarIntegracionM2M } from "@/lib/server/integracion-m2m";
import { StandsIntegracionApplicationService } from "@/application/stands-integracion/stands-integracion-service";
import { standsIntegracionRepo } from "@/infrastructure/persistence/stands-integracion-repository";

const service = new StandsIntegracionApplicationService(standsIntegracionRepo);

export const standsExhibidoraController = {
  async listar(request: Request): Promise<NextResponse> {
    if (!validarIntegracionM2M(request)) {
      return error(API_ERROR_CODES.FORBIDDEN, "API key invalida", 403);
    }

    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get("empresaId")?.trim();
    const tipoEvento = searchParams.get("tipoEvento") ? Number(searchParams.get("tipoEvento")) : undefined;
    const codigoEvento = searchParams.get("codigoEvento") ? Number(searchParams.get("codigoEvento")) : undefined;
    if (!empresaId) {
      return error(API_ERROR_CODES.VALIDATION, "empresaId requerido", 400);
    }

    try {
      return success(await service.listarStandsExhibidora(empresaId, tipoEvento, codigoEvento));
    } catch (e) {
      return error(API_ERROR_CODES.INTERNAL, e instanceof Error ? e.message : "No se pudieron listar stands de la exhibidora", 500);
    }
  },
};
