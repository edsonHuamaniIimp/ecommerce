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

/** Normaliza el tipo de documento de una linea de carga masiva ("DNI", "CE", "1"...). */
export function normalizarTipoDocumentoPersona(valor: string): string {
  const v = String(valor ?? "").trim().toUpperCase();
  if (v === "DNI" || v === TIPOS_DOCUMENTO_PERSONA.DNI) return TIPOS_DOCUMENTO_PERSONA.DNI;
  if (v === "CE" || v === "CARNE" || v === "CARNET" || v === TIPOS_DOCUMENTO_PERSONA.CARNE_EXTRANJERIA) return TIPOS_DOCUMENTO_PERSONA.CARNE_EXTRANJERIA;
  if (v === "PAS" || v === "PASAPORTE" || v === TIPOS_DOCUMENTO_PERSONA.PASAPORTE) return TIPOS_DOCUMENTO_PERSONA.PASAPORTE;
  return TIPOS_DOCUMENTO_PERSONA.DNI;
}
