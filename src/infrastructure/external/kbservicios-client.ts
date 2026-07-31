import type { IKbServiciosClient, ApiEventType, ApiEvent } from "@/domain/ports/kbservicios-client";

const BASE_URL = process.env.KBSERVICIOS_URL as string;
if (!BASE_URL) throw new Error("KBSERVICIOS_URL no definida en .env");

async function fetchApi<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
  if (!res.ok) throw new Error(`API eventos: ${res.status}`);
  return res.json() as Promise<T>;
}

function extractArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return null;
  const rec = data as Record<string, unknown>;
  for (const key of ["listEvent", "eventslist", "data", "payload", "results", "list"]) {
    if (Array.isArray(rec[key])) return rec[key] as unknown[];
  }
  for (const key of Object.keys(rec)) {
    if (Array.isArray(rec[key])) return rec[key] as unknown[];
  }
  return null;
}

export class KbServiciosClient implements IKbServiciosClient {
  async listarTiposEvento(): Promise<ApiEventType[]> {
    try {
      const data = await fetchApi<unknown>("/rest/listeventtype");
      return (extractArray(data) ?? []) as ApiEventType[];
    } catch {
      return [];
    }
  }

  async listarEventos(code: number): Promise<ApiEvent[]> {
    try {
      const data = await fetchApi<unknown>("/rest/events", { code });
      return (extractArray(data) ?? []) as ApiEvent[];
    } catch (err) {
      console.error(`[kbServicios] Error code=${code}:`, err instanceof Error ? err.message : err);
      return [];
    }
  }
}
