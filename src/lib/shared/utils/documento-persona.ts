import { TIPOS_DOCUMENTO_PERSONA } from "@/lib/shared/constants";

/** Valida el documento segun el tipo de servicio-persona (1 DNI, 4 CE, 7 pasaporte). */
export function validarDocumentoPersona(tipoDocumento: string, documento: string): string | null {
  const doc = String(documento ?? "").trim();
  if (tipoDocumento === TIPOS_DOCUMENTO_PERSONA.DNI) {
    return /^\d{8}$/.test(doc) ? null : "El DNI debe tener 8 digitos";
  }
  if (tipoDocumento === TIPOS_DOCUMENTO_PERSONA.CARNE_EXTRANJERIA || tipoDocumento === TIPOS_DOCUMENTO_PERSONA.PASAPORTE) {
    return /^[A-Za-z0-9]{1,15}$/.test(doc) ? null : "El documento debe ser alfanumerico (maximo 15)";
  }
  return "Tipo de documento invalido";
}

/**
 * Limpia el documento segun su tipo: el DNI conserva solo digitos; carne y pasaporte son
 * alfanumericos (se quitan separadores y se pasa a mayusculas, nunca se descartan letras).
 */
export function normalizarDocumentoPersona(tipoDocumento: string | null | undefined, documento: string | null | undefined): string {
  const doc = String(documento ?? "").trim();
  const tipo = normalizarTipoDocumentoPersona(tipoDocumento ?? TIPOS_DOCUMENTO_PERSONA.DNI);
  return tipo === TIPOS_DOCUMENTO_PERSONA.DNI ? doc.replace(/\D/g, "") : doc.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Normaliza el tipo de documento de una linea de carga masiva ("DNI", "CE", "1"...). */
export function normalizarTipoDocumentoPersona(valor: string): string {
  const v = String(valor ?? "").trim().toUpperCase();
  if (v === "DNI" || v === TIPOS_DOCUMENTO_PERSONA.DNI) return TIPOS_DOCUMENTO_PERSONA.DNI;
  if (v === "CE" || v === "CARNE" || v === "CARNET" || v === TIPOS_DOCUMENTO_PERSONA.CARNE_EXTRANJERIA) return TIPOS_DOCUMENTO_PERSONA.CARNE_EXTRANJERIA;
  if (v === "PAS" || v === "PASAPORTE" || v === TIPOS_DOCUMENTO_PERSONA.PASAPORTE) return TIPOS_DOCUMENTO_PERSONA.PASAPORTE;
  return TIPOS_DOCUMENTO_PERSONA.DNI;
}
