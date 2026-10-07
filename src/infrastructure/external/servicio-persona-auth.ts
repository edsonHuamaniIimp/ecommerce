/**
 * Autenticacion compartida de servicio-persona (personas y empresas):
 * login con token cacheado (30 min, sin refresco) y reintento unico ante 401.
 * Las credenciales son las mismas para ambos recursos y son independientes por
 * ambiente (pruebas / produccion) — ver guia-consumo-servicio-persona.md.
 */
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";

const REFRESCO_ANTICIPADO_MS = 60_000;
const TIMEOUT_PETICION_MS = 15_000;

/** Cache de token en memoria del proceso (30 min), atada a la URL del ambiente. */
let tokenCache: { apiUrl: string; token: string; expiraEn: number } | null = null;

/** Limpia la cache de token (pruebas). */
export function resetServicioPersonaTokenCache(): void {
  tokenCache = null;
}

/** Configuracion del servicio-persona (compartida por personas y empresas). */
function config(): { apiUrl: string; usuario: string; clave: string } {
  const apiUrl = (process.env.PERSONAS_API_URL ?? "").replace(/\/+$/, "");
  const usuario = process.env.PERSONAS_API_USUARIO;
  const clave = process.env.PERSONAS_API_CLAVE;
  if (!apiUrl || !usuario || !clave) {
    throw new DomainError(
      "PERSONAS_API_URL, PERSONAS_API_USUARIO y PERSONAS_API_CLAVE deben estar definidos en .env (servicio-persona).",
      API_ERROR_CODES.INTERNAL,
      500,
    );
  }
  return { apiUrl, usuario, clave };
}

async function login(): Promise<string> {
  const { apiUrl, usuario, clave } = config();
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, clave }),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_PETICION_MS),
  });
  if (!res.ok) {
    throw new DomainError("No se pudo autenticar con servicio-persona", API_ERROR_CODES.UNAUTHORIZED, 502);
  }
  const json = (await res.json()) as { token: string; expiraEnSegundos: number };
  tokenCache = { apiUrl, token: json.token, expiraEn: Date.now() + json.expiraEnSegundos * 1000 };
  return json.token;
}

async function obtenerToken(): Promise<string> {
  const { apiUrl } = config();
  if (tokenCache && tokenCache.apiUrl === apiUrl && tokenCache.expiraEn > Date.now() + REFRESCO_ANTICIPADO_MS) {
    return tokenCache.token;
  }
  return login();
}

interface ErrorServicioPersona {
  codigo?: string;
  mensaje?: string;
  detalles?: string[];
}

export interface PeticionOpciones {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  /** true = el 404 se devuelve como null en lugar de error (busquedas exactas). */
  permitir404?: boolean;
}

/** Peticion autenticada a servicio-persona con reintento unico ante 401. */
export async function peticionServicioPersona<T>(path: string, options: PeticionOpciones = {}): Promise<T> {
  const { apiUrl } = config();
  const ejecutar = async (token: string) =>
    fetch(`${apiUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_PETICION_MS),
    });

  let res = await ejecutar(await obtenerToken());

  if (res.status === 401) {
    tokenCache = null;
    res = await ejecutar(await obtenerToken());
    if (res.status === 401) {
      throw new DomainError("La sesion con servicio-persona expiro", API_ERROR_CODES.UNAUTHORIZED, 502);
    }
  }

  if (res.status === 404 && options.permitir404) {
    return null as T;
  }
  if (res.status === 400) {
    const json = (await res.json().catch(() => null)) as ErrorServicioPersona | null;
    const detalle = (json?.detalles ?? []).join(" | ");
    throw new DomainError(
      detalle || json?.mensaje || "Datos invalidos en servicio-persona",
      API_ERROR_CODES.VALIDATION,
      400,
    );
  }
  if (res.status === 403) {
    throw new DomainError("servicio-persona requiere un usuario con rol ESCRITURA", API_ERROR_CODES.FORBIDDEN, 502);
  }
  if (res.status === 409) {
    throw new DomainError("El documento ya existe en servicio-persona", API_ERROR_CODES.CONFLICT, 409);
  }
  if (res.status === 429) {
    throw new DomainError("Demasiados intentos en servicio-persona. Espera unos minutos", API_ERROR_CODES.TOO_MANY_REQUESTS, 429);
  }
  if (!res.ok) {
    throw new DomainError(`Error de servicio-persona: ${res.status}`, API_ERROR_CODES.INTERNAL, 502);
  }

  return (await res.json()) as T;
}
