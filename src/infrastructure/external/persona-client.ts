/**
 * Cliente de servicio-persona (fuente de personas del ecosistema IIMP):
 * login con token cacheado (30 min, sin refresco) y reintento unico ante 401.
 * Los datos de la persona viven en la fuente; aca solo se usa su `sie_code`.
 *
 * Doc: docs/05-integraciones/guia-consumo-servicio-persona.md
 */
import { enviarBinarioServicioPersona, peticionServicioPersona, resetServicioPersonaTokenCache } from "./servicio-persona-auth";
import type { IPersonaClient, NuevaPersonaApi, PersonaApi } from "@/domain/ports/persona-client";

/** Limpia la cache de token (pruebas). */
export function resetPersonaTokenCache(): void {
  resetServicioPersonaTokenCache();
}

function mapearPersona(raw: Record<string, unknown>): PersonaApi {
  const texto = (valor: unknown) => (valor === undefined || valor === null ? undefined : String(valor));
  return {
    sie_code: texto(raw.sie_code),
    apellido_paterno: texto(raw.apellido_paterno),
    apellido_materno: texto(raw.apellido_materno),
    nombres: texto(raw.nombres),
    nombre_completo: texto(raw.nombre_completo),
    id_tipo_documento: texto(raw.id_tipo_documento),
    documento: texto(raw.documento),
    direccion: texto(raw.direccion),
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
    ...(dto.direccion ? { direccion: dto.direccion } : {}),
    ...(dto.correo ? { correo: dto.correo } : {}),
    ...(dto.celular ? { celular: dto.celular } : {}),
  };
}

export class PersonaApiClient implements IPersonaClient {
  async buscarPorDocumento(documento: string, tipoDocumento?: string): Promise<PersonaApi | null> {
    if (tipoDocumento) {
      const json = await peticionServicioPersona<Record<string, unknown> | null>(
        `/personas/documento?tipoDocumento=${encodeURIComponent(tipoDocumento)}&numeroDocumento=${encodeURIComponent(documento)}`,
        { permitir404: true },
      );
      return json ? mapearPersona(json) : null;
    }
    const json = await peticionServicioPersona<{ contenido?: Record<string, unknown>[] }>(
      `/personas?q=${encodeURIComponent(documento)}&pagina=0&tamanio=20`,
    );
    const match = (json.contenido ?? []).find((p) => String(p.documento ?? "") === documento);
    return match ? mapearPersona(match) : null;
  }

  async buscarPersonas(q: string): Promise<PersonaApi[]> {
    const json = await peticionServicioPersona<{ contenido?: Record<string, unknown>[] }>(
      `/personas?q=${encodeURIComponent(q)}&pagina=0&tamanio=20`,
    );
    return (json.contenido ?? []).map(mapearPersona);
  }

  async obtenerPersona(sieCode: string): Promise<PersonaApi | null> {
    const json = await peticionServicioPersona<Record<string, unknown> | null>(
      `/personas/${encodeURIComponent(sieCode)}`,
      { permitir404: true },
    );
    return json ? mapearPersona(json) : null;
  }

  async crearPersona(dto: NuevaPersonaApi): Promise<PersonaApi> {
    const creada = await peticionServicioPersona<Record<string, unknown>>("/personas", {
      method: "POST",
      body: cuerpoPersona(dto),
    });
    return mapearPersona(creada);
  }

  async actualizarPersona(sieCode: string, dto: NuevaPersonaApi): Promise<PersonaApi> {
    const actualizada = await peticionServicioPersona<Record<string, unknown>>(
      `/personas/${encodeURIComponent(sieCode)}`,
      { method: "PUT", body: cuerpoPersona(dto) },
    );
    return mapearPersona(actualizada);
  }

  async subirFoto(sieCode: string, imagen: Buffer, contentType: string): Promise<void> {
    await enviarBinarioServicioPersona(`/personas/${encodeURIComponent(sieCode)}/foto`, imagen, contentType);
  }

  async borrarFoto(sieCode: string): Promise<void> {
    await enviarBinarioServicioPersona(`/personas/${encodeURIComponent(sieCode)}/foto`, null, null, "DELETE");
  }
}
