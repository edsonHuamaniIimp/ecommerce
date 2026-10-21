import 'server-only';

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { DomainError } from "@/domain/errors/domain-error";
import { apiErrorLogger } from "@/lib/server/api-error-logger";

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

export function createRouter(config: RouterConfig) {
  const exports: Record<string, (req: Request, context?: { params: Promise<{ slug: string[] }> }) => Promise<NextResponse>> = {};

  for (const [method, routes] of Object.entries(config)) {
    exports[method] = async (req: Request, context?: { params: Promise<{ slug: string[] }> }) => {
      const params = await context?.params;
      const path = params?.slug?.join("/") ?? "";
      const action = routes[path];
      if (!action) {
        const message = `Endpoint '${method} /${path}' no encontrado`;
        apiErrorLogger.registrar({ request: req, status: 404, code: API_ERROR_CODES.NOT_FOUND, message, action: path });
        return NextResponse.json({ error: message }, { status: 404 });
      }

      try {
        const result = action(req);
        const response = result instanceof NextResponse ? result : await result;
        /* Toda respuesta de error del API queda registrada (incluye validaciones/business). */
        if (response.status >= 400) {
          let code: string = API_ERROR_CODES.INTERNAL;
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
          apiErrorLogger.registrar({ request: req, status: response.status, code, message, action: path });
        }
        return response;
      } catch (err) {
        if (err instanceof DomainError) {
          apiErrorLogger.registrar({ request: req, status: err.status, code: err.code, message: err.message, stack: err.stack, action: path });
          return NextResponse.json({ success: false, error: { code: err.code, message: err.message } }, { status: err.status });
        }
        if (err instanceof ZodError) {
          const message = err.issues.map((issue) => issue.message).join("; ");
          apiErrorLogger.registrar({ request: req, status: 400, code: API_ERROR_CODES.VALIDATION, message, stack: err.stack, action: path });
          return NextResponse.json({ success: false, error: { code: API_ERROR_CODES.VALIDATION, message } }, { status: 400 });
        }
        const message = err instanceof Error ? err.message : "Error interno";
        apiErrorLogger.registrar({ request: req, status: 500, code: API_ERROR_CODES.INTERNAL, message, stack: err instanceof Error ? err.stack : undefined, action: path });
        return NextResponse.json({ success: false, error: { code: API_ERROR_CODES.INTERNAL, message } }, { status: 500 });
      }
    };
  }

  return exports;
}
