import type { IPlanogessClient } from "@/domain/ports/planogess-client";

/**
 * Cliente del API real de stands del IIMP (`liststand`): login con cuenta tecnica
 * (token de 30 min, sin refresco) y listado de stands de un evento agrupados por
 * pabellon y tipo. Se aplana a filas para el preview/importacion de Vinculacion.
 *
 * Doc: API-LISTSTAND-INTEGRACION.md (ambiente de pruebas por defecto).
 */
const REFRESCO_ANTICIPADO_MS = 60_000;

/** Cache de token en memoria del proceso (30 min); se renueva antes de expirar. */
let tokenCache: { token: string; expiraEn: number } | null = null;

interface ListstandStand {
  Numero: string;
  Orden?: number | null;
  Area?: string;
  Precio?: string;
  Moneda?: string;
  Estado?: string;
}

interface ListstandTipo {
  Codigo: number;
  Nombre: string;
  Stands: ListstandStand[];
}

interface ListstandPabellon {
  Codigo: number;
  Nombre: string;
  Tipos: ListstandTipo[];
}

interface ListstandRespuesta {
  Pabellones?: ListstandPabellon[];
  success?: boolean;
  message?: string;
  codigo?: string;
  mensaje?: string;
}

function config(): { apiUrl: string; usuario: string; clave: string } {
  const apiUrl = (process.env.LISTSTAND_API_URL ?? "https://secure2.iimp.org:8443/servicio-eventos-pruebas/api").replace(/\/+$/, "");
  const usuario = process.env.LISTSTAND_USUARIO;
  const clave = process.env.LISTSTAND_CLAVE;
  if (!usuario || !clave) {
    throw new Error("LISTSTAND_USUARIO y LISTSTAND_CLAVE deben estar definidos en .env (cuenta tecnica IIMP, acceso VTA).");
  }
  return { apiUrl, usuario, clave };
}

/** fetch con la excepcion TLS que exige secure2.iimp.org (certificado no confiable local). */
async function fetchSecure(url: string, init: RequestInit): Promise<Response> {
  const previo = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    return await fetch(url, { ...init, cache: "no-store" });
  } finally {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = previo ?? "1";
  }
}

async function mensajeError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { mensaje?: string; message?: string };
    return body.mensaje ?? body.message ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function login(): Promise<string> {
  const { apiUrl, usuario, clave } = config();
  const res = await fetchSecure(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, clave }),
  });
  if (!res.ok) throw new Error(`Liststand login: ${await mensajeError(res)}`);
  const data = (await res.json()) as { token?: string; expiraEnSegundos?: number };
  if (!data.token) throw new Error("Liststand login: respuesta sin token");
  tokenCache = { token: data.token, expiraEn: Date.now() + (data.expiraEnSegundos ?? 1800) * 1000 };
  return data.token;
}

async function tokenVigente(): Promise<string> {
  if (tokenCache && tokenCache.expiraEn - Date.now() > REFRESCO_ANTICIPADO_MS) return tokenCache.token;
  return login();
}

/** Solo pruebas: limpia el cache de token en memoria del proceso. */
export function resetListstandTokenCache(): void {
  tokenCache = null;
}

export class ListstandClient implements IPlanogessClient {
  /** Lista los stands del evento (aplanados: stand, pabellon, tipo, area, precio, estado). */
  async fetchStands(tipoEvento: number, codigoEvento: number): Promise<Record<string, unknown>[]> {
    const { apiUrl } = config();
    const body = JSON.stringify({ TipEvCod: tipoEvento, EvenCod: codigoEvento, Estado: "TODOS" });

    const listar = async (token: string) =>
      fetchSecure(`${apiUrl}/stands/liststand`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body,
      });

    let res = await listar(await tokenVigente());
    /* Token vencido: re-login y un reintento. */
    if (res.status === 401) {
      tokenCache = null;
      res = await listar(await tokenVigente());
    }
    if (!res.ok) throw new Error(`Liststand API: ${await mensajeError(res)}`);

    const data = (await res.json()) as ListstandRespuesta;
    const filas: Record<string, unknown>[] = [];
    for (const pabellon of data.Pabellones ?? []) {
      for (const tipo of pabellon.Tipos ?? []) {
        for (const stand of tipo.Stands ?? []) {
          filas.push({
            stand: stand.Numero,
            pabellon: pabellon.Nombre,
            tipo: tipo.Nombre,
            area: stand.Area ?? "",
            precio: stand.Precio ?? "",
            estado: stand.Estado ?? "",
            moneda: stand.Moneda ?? "USD",
            orden: stand.Orden ?? null,
            pabellonCodigo: pabellon.Codigo,
            tipoCodigo: tipo.Codigo,
          });
        }
      }
    }
    return filas;
  }
}
