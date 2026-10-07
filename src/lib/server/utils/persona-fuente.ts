import type { IPersonaClient, PersonaApi } from "@/domain/ports/persona-client";

/** Datos locales de la persona que se reflejan en la fuente (servicio-persona). */
export interface PersonaDeseada {
  tipoDocumento: string;
  documento: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  nombres: string;
  correo?: string | null;
  celular?: string | null;
  direccion?: string | null;
}

/**
 * Criterio de deduplicacion de personas: si ya existe en la fuente se reutiliza;
 * solo se actualiza (`PUT /personas/{codigo}`) cuando algun dato difiere.
 * Best-effort: si la fuente falla, la operacion local continua (devuelve false).
 */
export async function actualizarPersonaSiDifiere(
  personaClient: IPersonaClient,
  actual: PersonaApi,
  deseada: PersonaDeseada,
): Promise<boolean> {
  const sieCode = String(actual.sie_code ?? "").trim();
  if (!sieCode) return false;

  const igual = (a?: string | null, b?: string | null) => (a ?? "").trim() === (b ?? "").trim();
  const sinCambios =
    igual(actual.apellido_paterno, deseada.apellidoPaterno) &&
    igual(actual.apellido_materno, deseada.apellidoMaterno) &&
    igual(actual.nombres, deseada.nombres) &&
    igual(actual.correo, deseada.correo) &&
    igual(actual.celular, deseada.celular) &&
    (!deseada.direccion || igual(actual.direccion, deseada.direccion));
  if (sinCambios) return false;

  try {
    await personaClient.actualizarPersona(sieCode, {
      apellido_paterno: deseada.apellidoPaterno,
      apellido_materno: deseada.apellidoMaterno ?? null,
      nombres: deseada.nombres,
      id_tipo_documento: deseada.tipoDocumento,
      documento: deseada.documento,
      direccion: deseada.direccion ?? null,
      correo: deseada.correo ?? null,
      celular: deseada.celular ?? null,
    });
    return true;
  } catch {
    return false;
  }
}
