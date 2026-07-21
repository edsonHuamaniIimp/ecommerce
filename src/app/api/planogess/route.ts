import { NextResponse } from "next/server";

const API_URL = process.env.PLANOGESS_API_URL ?? "https://secure2.iimp.org:8443/KBEventosPruebas/rest/planogess";

function extraerLista(obj: unknown, maxDepth = 4): unknown[] | null {
  if (Array.isArray(obj)) return obj;
  if (!obj || typeof obj !== "object" || maxDepth <= 0) return null;
  const rec = obj as Record<string, unknown>;
  for (const key of ["payload", "data", "stands", "lista", "items", "rows", "results", "records"]) {
    const val = rec[key];
    if (Array.isArray(val)) return val;
  }
  for (const key of Object.keys(rec)) {
    const val = rec[key];
    if (Array.isArray(val)) return val;
    if (val && typeof val === "object") {
      const nested = extraerLista(val, maxDepth - 1);
      if (nested) return nested;
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { tipoEvento?: number; codigoEvento?: number };

    if (!body.tipoEvento || !body.codigoEvento) {
      return NextResponse.json(
        { error: "tipoEvento y codigoEvento son requeridos" },
        { status: 400 },
      );
    }

    const payload = {
      TIPEVCOD: body.tipoEvento,
      EVENCOD: body.codigoEvento,
    };

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `API externa respondio con ${res.status}`, detalle: text },
        { status: 502 },
      );
    }

    const data: unknown = await res.json();
    const lista = extraerLista(data);

    if (lista) {
      return NextResponse.json(lista);
    }

    return NextResponse.json(
      { error: "No se encontro una lista en la respuesta", raw: data },
      { status: 422 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
