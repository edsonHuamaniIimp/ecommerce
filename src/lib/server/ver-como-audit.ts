import "server-only";

import { services } from "@/lib/server/services";
import { requestMetadata } from "@/lib/server/request-metadata";
import { VER_COMO } from "@/lib/shared/constants";

interface SesionVerComo {
  sub: string;
  email?: string;
  name?: string;
}

/**
 * Registro central de "Ver como". Es fail-closed: si no se puede auditar,
 * la consulta no debe continuar.
 */
export async function auditarVerComo(
  request: Request,
  session: SesionVerComo,
  accion: string,
  mensaje: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const requestMeta = requestMetadata(request);
  const empresaId = typeof metadata.empresaId === "string" ? metadata.empresaId : null;
  await services.auditoria.registrar({
    tipo: VER_COMO.TIPO_AUDITORIA,
    entidad: empresaId ? `empresa:${empresaId}` : "ver_como:busqueda",
    actor: session.sub,
    mensaje,
    metadata: {
      accion,
      actorEmail: session.email ?? null,
      actorName: session.name ?? null,
      ...metadata,
    },
    ip: requestMeta.ip,
    userAgent: requestMeta.userAgent,
    metodo: requestMeta.metodo,
    ruta: requestMeta.ruta,
  });
}
