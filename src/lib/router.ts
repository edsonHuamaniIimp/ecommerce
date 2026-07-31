import { NextResponse } from "next/server";

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
      const result = action(req);
      return result instanceof NextResponse ? result : await result;
    };

    // Wrap with error handler
    const handler = exports[method];
    exports[method] = async (req, ctx) => {
      try {
        return await handler(req, ctx);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error interno";
        return NextResponse.json({ success: false, error: { code: "INTERNAL", message } }, { status: 500 });
      }
    };
  }

  return exports;
}
