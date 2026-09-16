import { NextResponse } from "next/server";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { entidadesClient } from "@/infrastructure/external/entidades-client";

export const entidadesController = {
  async searchPerson(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as { documento?: string; nombre?: string };
    if (!body.documento && !body.nombre) {
      return error(API_ERROR_CODES.VALIDATION, "Al menos documento o nombre requerido", 400);
    }
    try {
      const data = await entidadesClient.searchPerson(body);
      return success(data);
    } catch (e) {
      return error(API_ERROR_CODES.BAD_GATEWAY, e instanceof Error ? e.message : "No se pudo consultar", 502);
    }
  },

  async searchEmpresa(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as { nroDocument?: string; razonSocial?: string };
    if (!body.nroDocument && !body.razonSocial) {
      return error(API_ERROR_CODES.VALIDATION, "Al menos nroDocument o razonSocial requerido", 400);
    }
    try {
      const data = await entidadesClient.searchEmpresa(body);
      return success(data);
    } catch (e) {
      return error(API_ERROR_CODES.BAD_GATEWAY, e instanceof Error ? e.message : "No se pudo consultar", 502);
    }
  },
};
