import 'server-only';

const BASE_URL = process.env.ENTIDADES_API_URL ?? process.env.KBSERVICIOS_URL ?? "https://secure2.iimp.org:8443/KBServiciosPruebaIIMPJavaEnvironment";

interface SearchPersonParams {
  documento?: string;
  nombre?: string;
}

interface SearchEmpresaParams {
  nroDocument?: string;
  razonSocial?: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Error externo: ${res.status}`);
  const json = (await res.json()) as T;
  return json;
}

export const entidadesClient = {
  async searchPerson(params: SearchPersonParams) {
    return post<{ success: boolean; message: string; ListInfoPersona: Record<string, unknown>[] }>(
      "/rest/searchpersonv00",
      params,
    );
  },

  async searchEmpresa(params: SearchEmpresaParams) {
    return post<{ success: boolean; message: string; ListInfoEmpresa: Record<string, unknown>[] }>(
      "/rest/searchempresa",
      params,
    );
  },
};
