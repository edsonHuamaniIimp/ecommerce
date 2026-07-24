async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const internalApi = {
  get<T>(url: string): Promise<T> {
    return request<T>(url);
  },
  post<T>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined });
  },
  patch<T>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
  },
  delete<T>(url: string): Promise<T> {
    return request<T>(url, { method: "DELETE" });
  },
};
