import 'client-only';

import type { ApiResult } from "@/lib/shared/api-types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const hasBody = options?.body !== undefined;
  const esFormData = hasBody && typeof FormData !== "undefined" && options?.body instanceof FormData;
  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      ...(hasBody && !esFormData ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    } as Record<string, string>,
  });
  const json = await res.json().catch(() => ({})) as ApiResult<T> | { error?: string } | null;
  if (!res.ok) {
    if (json && typeof json === "object" && "success" in json && json.success === false && "error" in json) {
      throw new Error((json as ApiResult<T> & { success: false }).error.message);
    }
    if (json && "error" in json && typeof json.error === "string") {
      throw new Error(json.error);
    }
    throw new Error(`Error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  if (json && typeof json === "object" && "success" in json && json.success === true && "data" in json) {
    return json.data as T;
  }
  return json as T;
}

export const internalApi = {
  get<T>(url: string): Promise<T> {
    return request<T>(url);
  },
  post<T>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined });
  },
  /** POST multipart (subida de archivos). No fija Content-Type: lo arma el navegador. */
  postForm<T>(url: string, formData: FormData): Promise<T> {
    return request<T>(url, { method: "POST", body: formData });
  },
  patch<T>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
  },
  delete<T>(url: string): Promise<T> {
    return request<T>(url, { method: "DELETE" });
  },
};
