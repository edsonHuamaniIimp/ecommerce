import 'server-only';

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { DomainError } from "@/domain/errors/domain-error";
import { errorLogger } from "@/lib/server/error-logger";

export { DomainError } from "@/domain/errors/domain-error";

type RouteFn = (req: Request) => Promise<NextResponse> | NextResponse;
type RouteMap = Record<string, RouteFn>;

interface RouterConfig {
  GET?: RouteMap;
  POST?: RouteMap;
  PATCH?: RouteMap;
  PUT?: RouteMap;
  DELETE?: RouteMap;
}

/** Persiste un error de API (no bloquea la respuesta). */
function registrarErrorApi(req: Request, path: string, status: number, code: string, message: string, stack?: string) {
  void errorLogger.log({
    message,
    stack,
    url: req.url,
    metadata: {
      source: "server-api",
      method: req.method,
      path: path || req.url,
      status,
      code,
    },
  });
}

export function createRouter(config: RouterConfig) {
  const exports: Record<string, (req: Request, context?: { params: Promise<{ slug: string[] }> }) => Promise<NextResponse>> = {};

  for (const [method, routes] of Object.entries(config)) {
    exports[method] = async (req: Request, context?: { params: Promise<{ slug: string[] }> }) => {
      const params = await context?.params;
      const path = params?.slug?.join("/") ?? "";
      const action = routes[path];
      if (!action) {
        const message = `Endpoint '${method} /${path}' no encontrado`;
        registrarErrorApi(req, path, 404, "NOT_FOUND", message);
        return NextResponse.json({ error: message }, { status: 404 });
      }

      try {
        const result = action(req);
        const response = result instanceof NextResponse ? result : await result;
        /* Toda respuesta de error del API queda registrada (incluye validaciones/business). */
        if (response.status >= 400) {
          let code = "INTERNAL";
          let message = response.statusText || `HTTP ${response.status}`;
          try {
            const body = (await response.clone().json()) as {
              error?: { code?: string; message?: string } | string;
            };
            if (typeof body.error === "string") {
              message = body.error;
            } else if (body.error) {
              code = String(body.error.code ?? code);
              message = body.error.message ?? message;
            }
          } catch { /* respuesta sin JSON */ }
          registrarErrorApi(req, path, response.status, code, message);
        }
        return response;
      } catch (err) {
        if (err instanceof DomainError) {
          registrarErrorApi(req, path, err.status, err.code, err.message, err.stack);
          return NextResponse.json({ success: false, error: { code: err.code, message: err.message } }, { status: err.status });
        }
        if (err instanceof ZodError) {
          const message = err.issues.map((issue) => issue.message).join("; ");
          registrarErrorApi(req, path, 400, API_ERROR_CODES.VALIDATION, message, err.stack);
          return NextResponse.json({ success: false, error: { code: API_ERROR_CODES.VALIDATION, message } }, { status: 400 });
        }
        const message = err instanceof Error ? err.message : "Error interno";
        registrarErrorApi(req, path, 500, "INTERNAL", message, err instanceof Error ? err.stack : undefined);
        return NextResponse.json({ success: false, error: { code: "INTERNAL", message } }, { status: 500 });
      }
    };
  }

  return exports;
}
