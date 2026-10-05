/**
 * Cliente de servicio-persona (fuente de personas del ecosistema IIMP):
 * login con token cacheado (30 min, sin refresco) y reintento unico ante 401.
 * Los datos de la persona viven en la fuente; aca solo se usa su `sie_code`.
 *
 * Doc: docs/05-integraciones/guia-consumo-servicio-persona.md
 */
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import type { IPersonaClient, NuevaPersonaApi, PersonaApi } from "@/domain/ports/persona-client";

const REFRESCO_ANTICIPADO_MS = 60_000;

/** Cache de token en memoria del proceso (30 min). */
let tokenCache: { token: string; expiraEn: number } | null = null;

/** Limpia la cache de token (pruebas). */
export function resetPersonaTokenCache(): void {
  tokenCache = null;
}

const apiUrl = (process.env.PERSONAS_API_URL ?? "").replace(/\/+$/, "");
const usuario = process.env.PERSONAS_API_USUARIO;
const clave = process.env.PERSONAS_API_CLAVE;

async function login(): Promise<string> {
  if (!apiUrl || !usuario || !clave) {
    throw new DomainError(
      "PERSONAS_API_URL, PERSONAS_API_USUARIO y PERSONAS_API_CLAVE deben estar definidos en .env (servicio-persona).",
      API_ERROR_CODES.INTERNAL,
      500,
    );
  }
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, clave }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new DomainError("No se pudo autenticar con el servicio de personas", API_ERROR_CODES.UNAUTHORIZED, 502);
  }
  const json = (await res.json()) as { token: string; expiraEnSegundos: number };
  tokenCache = { token: json.token, expiraEn: Date.now() + json.expiraEnSegundos * 1000 };
  return json.token;
}

async function obtenerToken(): Promise<string> {
  if (tokenCache && tokenCache.expiraEn > Date.now() + REFRESCO_ANTICIPADO_MS) {
    return tokenCache.token;
  }
  return login();
}

interface ErrorPersona {
  codigo?: string;
  mensaje?: string;
  detalles?: string[];
}

async function peticion<T>(path: string, options: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {}): Promise<T> {
  const ejecutar = async (token: string) =>
    fetch(`${apiUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });

  let res = await ejecutar(await obtenerToken());

  if (res.status === 401) {
    tokenCache = null;
    res = await ejecutar(await obtenerToken());
    if (res.status === 401) {
      throw new DomainError("La sesion con el servicio de personas expiro", API_ERROR_CODES.UNAUTHORIZED, 502);
    }
  }

  if (res.status === 400) {
    const json = (await res.json().catch(() => null)) as ErrorPersona | null;
    const detalle = (json?.detalles ?? []).join(" | ");
    throw new DomainError(
      detalle || json?.mensaje || "Datos invalidos en el servicio de personas",
      API_ERROR_CODES.VALIDATION,
      400,
    );
  }
  if (res.status === 403) {
    throw new DomainError("El servicio de personas requiere un usuario con rol ESCRITURA", API_ERROR_CODES.FORBIDDEN, 502);
  }
  if (res.status === 409) {
    throw new DomainError("El documento ya existe en el servicio de personas", API_ERROR_CODES.CONFLICT, 409);
  }
  if (res.status === 429) {
    throw new DomainError("Demasiados intentos en el servicio de personas. Espera unos minutos", API_ERROR_CODES.TOO_MANY_REQUESTS, 429);
  }
  if (!res.ok) {
    throw new DomainError(`Error del servicio de personas: ${res.status}`, API_ERROR_CODES.INTERNAL, 502);
  }

  return (await res.json()) as T;
}

function mapearPersona(raw: Record<string, unknown>): PersonaApi {
  const texto = (valor: unknown) => (valor === undefined || valor === null ? undefined : String(valor));
  return {
    sie_code: texto(raw.sie_code),
    apellido_paterno: texto(raw.apellido_paterno),
    apellido_materno: texto(raw.apellido_materno),
    nombres: texto(raw.nombres),
    nombre_completo: texto(raw.nombre_completo),
    documento: texto(raw.documento),
    correo: texto(raw.correo),
    celular: texto(raw.celular),
  };
}

function cuerpoPersona(dto: NuevaPersonaApi): Record<string, string> {
  return {
    apellido_paterno: dto.apellido_paterno,
    nombres: dto.nombres,
    id_tipo_documento: dto.id_tipo_documento,
    documento: dto.documento,
    ...(dto.apellido_materno ? { apellido_materno: dto.apellido_materno } : {}),
    ...(dto.correo ? { correo: dto.correo } : {}),
    ...(dto.celular ? { celular: dto.celular } : {}),
  };
}

export class PersonaApiClient implements IPersonaClient {
  async buscarPorDocumento(documento: string): Promise<PersonaApi | null> {
    const json = await peticion<{ contenido?: Record<string, unknown>[] }>(
      `/personas?q=${encodeURIComponent(documento)}&pagina=0&tamanio=20`,
    );
    const match = (json.contenido ?? []).find((p) => String(p.documento ?? "") === documento);
    return match ? mapearPersona(match) : null;
  }

  async buscarPersonas(q: string): Promise<PersonaApi[]> {
    const json = await peticion<{ contenido?: Record<string, unknown>[] }>(
      `/personas?q=${encodeURIComponent(q)}&pagina=0&tamanio=20`,
    );
    return (json.contenido ?? []).map(mapearPersona);
  }

  async crearPersona(dto: NuevaPersonaApi): Promise<PersonaApi> {
    const creada = await peticion<Record<string, unknown>>("/personas", {
      method: "POST",
      body: cuerpoPersona(dto),
    });
    return mapearPersona(creada);
  }
}
