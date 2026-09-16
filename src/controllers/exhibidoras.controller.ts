import { NextResponse } from "next/server";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { validarIntegracionM2M } from "@/lib/server/integracion-m2m";
import { ExhibidorasApplicationService } from "@/application/exhibidoras/exhibidoras-service";
import { exhibidorasRepo } from "@/infrastructure/persistence/exhibidoras-repository";

const exhibidorasService = new ExhibidorasApplicationService(exhibidorasRepo);

export const exhibidorasController = {
  /**
   * Endpoint M2M de integración: lo consume el Sistema de Montaje
   * con x-api-key compartida.
   */
  async listar(request: Request): Promise<NextResponse> {
    if (!validarIntegracionM2M(request)) {
      return error(API_ERROR_CODES.FORBIDDEN, "API key invalida", 403);
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;

    try {
      return success(await exhibidorasService.listar(q));
    } catch (e) {
      return error(API_ERROR_CODES.INTERNAL, e instanceof Error ? e.message : "No se pudieron listar exhibidoras", 500);
    }
  },
};
