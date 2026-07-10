import { apiConfig, ApiError } from "./config";

function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: { error: string; code: string; detalles?: string[] } | null = null;
    try {
      body = await res.json();
    } catch {
      // cuerpo no JSON
    }
    throw new ApiError(
      (body?.code as ApiError["code"]) ?? "INTERNAL_ERROR",
      body?.error ?? `Error HTTP ${res.status}`,
      body?.detalles ?? [],
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function queryString(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  return qs.size > 0 ? `?${qs.toString()}` : "";
}

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = `${apiConfig.baseUrl}${path}${queryString(params ?? {})}`;
  const res = await fetch(url, { headers: { ...authHeader() } });
  return handleResponse<T>(res);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const url = `${apiConfig.baseUrl}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export const api = { get, post };
