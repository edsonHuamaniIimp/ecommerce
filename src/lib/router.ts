import { NextResponse } from "next/server";

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

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
        return NextResponse.json({ error: `Endpoint '${method} /${path}' no encontrado` }, { status: 404 });
      }

      try {
        const result = action(req);
        return result instanceof NextResponse ? result : await result;
      } catch (err) {
        if (err instanceof DomainError) {
          return NextResponse.json({ success: false, error: { code: err.code, message: err.message } }, { status: err.status });
        }
        const message = err instanceof Error ? err.message : "Error interno";
        return NextResponse.json({ success: false, error: { code: "INTERNAL", message } }, { status: 500 });
      }
    };
  }

  return exports;
}
