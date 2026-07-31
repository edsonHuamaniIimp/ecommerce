import type { IPlanogessClient } from "@/domain/ports/planogess-client";

const API_URL = process.env.PLANOGESS_API_URL as string;
if (!API_URL) throw new Error("PLANOGESS_API_URL no definida en .env");

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

export class PlanogessClient implements IPlanogessClient {
  async fetchStands(tipoEvento: number, codigoEvento: number): Promise<Record<string, unknown>[]> {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ TIPEVCOD: tipoEvento, EVENCOD: codigoEvento }),
      cache: "no-store",
    });
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";

    if (!res.ok) throw new Error(`Planogess API: ${res.status}`);

    const data: unknown = await res.json();
    const lista = extraerLista(data);
    return (lista ?? []) as Record<string, unknown>[];
  }
}
