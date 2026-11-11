import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth";
import { services } from "@/lib/server/services";
import { error, success } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { DomainError } from "@/domain/errors/domain-error";
import { dateUtils } from "@/lib/shared/utils/date";
import { ddConfiguracionSchema } from "@/validators/dd-configuracion.validator";
import type {
  DdAuditoriaItemDTO,
  DdConfiguracionDTO,
} from "@/types/dto/debida-diligencia";

async function sesionAdmin() {
  const session = await getSession();
  if (!session) throw new DomainError("No autorizado", API_ERROR_CODES.UNAUTHORIZED, 401);
  services.ddConfiguracion.autorizar(session);
  return session;
}

function mapConfig(config: Awaited<ReturnType<typeof services.ddConfiguracion.obtener>>): DdConfiguracionDTO {
  return {
    ...config,
    updatedAt: config.updatedAt ? dateUtils.toIso(config.updatedAt) : null,
  };
}

export const ddConfiguracionController = {
  async obtener(): Promise<NextResponse> {
    await sesionAdmin();
    return success(mapConfig(await services.ddConfiguracion.obtener()));
  },

  async actualizar(request: Request): Promise<NextResponse> {
    const session = await sesionAdmin();
    const parsed = ddConfiguracionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(
        API_ERROR_CODES.VALIDATION,
        parsed.error.issues.map((issue) => issue.message).join("; "),
        400,
      );
    }
    const config = await services.ddConfiguracion.actualizar(parsed.data, session);
    return success(mapConfig(config));
  },

  async auditoria(): Promise<NextResponse> {
    const session = await sesionAdmin();
    const items = await services.ddConfiguracion.listarAuditoria(session);
    const data: DdAuditoriaItemDTO[] = items.map((item) => ({
      ...item,
      createdAt: dateUtils.toIso(item.createdAt),
    }));
    return success({ data });
  },
};
