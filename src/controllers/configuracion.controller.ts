import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import { getSession } from "@/lib/server/auth";
import { actualizarPortalConfigSchema } from "@/validators/configuracion.validator";

/** Configuracion publica del portal: lectura abierta (login/presala), escritura con portal:manage. */
export const configuracionController = {
  /** Configuracion vigente (sin sesion: la consumen el login y la presala). */
  async obtenerPortal(): Promise<NextResponse> {
    return success(await services.configuracion.obtenerPortal());
  },

  /** Guarda la configuracion del portal (requiere sesion + portal:manage / admin:full). */
  async actualizarPortal(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) throw new DomainError("No autorizado", API_ERROR_CODES.UNAUTHORIZED, 401);
    services.configuracion.autorizarGestion(session.permissions);

    const parsed = actualizarPortalConfigSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const config = await services.configuracion.actualizarPortal(parsed.data, session.email);
    return success(config);
  },
};
