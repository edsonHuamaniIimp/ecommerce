import 'server-only';

const TOKEN = process.env.SUNAT_API_TOKEN;
const RUC_URL = "https://api.apis.net.pe/v2/sunat/ruc/full";
const DNI_URL = "https://api.apis.net.pe/v2/reniec/dni";

async function fetchAPI(url: string): Promise<Record<string, unknown>> {
  if (!TOKEN) throw new Error("SUNAT_API_TOKEN no configurada");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(res.status === 422 || res.status === 404 ? "No encontrado" : "Error de consulta externa");
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export const consultasClient = {
  async consultarRuc(numero: string) {
    return fetchAPI(`${RUC_URL}?numero=${encodeURIComponent(numero)}`);
  },
  async consultarDni(numero: string) {
    return fetchAPI(`${DNI_URL}?numero=${encodeURIComponent(numero)}`);
  },
};
