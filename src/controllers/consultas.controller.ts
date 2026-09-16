import { NextResponse } from "next/server";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { consultasClient } from "@/infrastructure/external/consultas-client";

export const sunatController = {
  async consultarRuc(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const numero = searchParams.get("numero");
    if (!numero || !/^\d{11}$/.test(numero)) {
      return error(API_ERROR_CODES.VALIDATION, "RUC invalido — 11 digitos requeridos", 400);
    }
    try {
      const data = await consultasClient.consultarRuc(numero);
      return success(data);
    } catch (e) {
      return error(API_ERROR_CODES.BAD_GATEWAY, e instanceof Error ? e.message : "No se pudo consultar", 502);
    }
  },
};

export const reniecController = {
  async consultarDni(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const numero = searchParams.get("numero");
    if (!numero || !/^\d{8}$/.test(numero)) {
      return error(API_ERROR_CODES.VALIDATION, "DNI invalido — 8 digitos requeridos", 400);
    }
    try {
      const data = await consultasClient.consultarDni(numero);
      return success(data);
    } catch (e) {
      return error(API_ERROR_CODES.BAD_GATEWAY, e instanceof Error ? e.message : "No se pudo consultar", 502);
    }
  },
};
