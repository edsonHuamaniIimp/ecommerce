import "server-only";

export interface RequestMetadata {
  ip: string | null;
  userAgent: string | null;
  metodo: string;
  ruta: string;
}

/** Metadatos de auditoria disponibles en el borde HTTP. */
export function requestMetadata(request: Request): RequestMetadata {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip =
    forwarded ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    null;
  const userAgent = headers.get("user-agent")?.slice(0, 500) ?? null;
  const url = new URL(request.url);

  return {
    ip,
    userAgent,
    metodo: request.method,
    ruta: url.pathname,
  };
}
