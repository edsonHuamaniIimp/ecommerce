import { REGEX_RUC, REGEX_DOCUMENTO_EMPRESA, TIPOS_DOCUMENTO_EMPRESA, type TipoDocumentoEmpresa } from "@/lib/shared/constants";

/**
 * Normaliza el documento de una empresa (RUC o RUT/no domiciliado): sin espacios,
 * puntos ni guiones; en mayusculas (la fuente exige alfanumerico hasta 20).
 */
export function normalizarDocumentoEmpresa(documento: string | null | undefined): string {
  return String(documento ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Resuelve el tipo de documento de empresa (codigo de servicio-persona):
 * - valor explicito del archivo/UI: RUC/6 o RUT/0 (aliases de no domiciliado);
 * - sin valor: autodetecta (11 digitos = RUC; el resto, RUT/no domiciliado).
 * Devuelve null solo si el valor explicito no se reconoce.
 */
export function resolverTipoDocumentoEmpresa(valor: string | null | undefined, documento: string): TipoDocumentoEmpresa | null {
  const v = String(valor ?? "").trim().toUpperCase();
  if (!v) {
    return REGEX_RUC.test(normalizarDocumentoEmpresa(documento))
      ? TIPOS_DOCUMENTO_EMPRESA.RUC
      : TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO;
  }
  if (v === "RUC" || v === TIPOS_DOCUMENTO_EMPRESA.RUC) return TIPOS_DOCUMENTO_EMPRESA.RUC;
  if (
    v === "RUT" ||
    v === "DNI" ||
    v === "EXTRANJERO" ||
    v === "EXTRANJERA" ||
    v === "OTRO" ||
    v === "NO DOMICILIADO" ||
    v === "NO_DOMICILIADO" ||
    v === TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO
  ) {
    return TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO;
  }
  return null;
}

/** Valida el documento segun su tipo; devuelve el error o null si es valido. */
export function validarDocumentoEmpresa(tipo: TipoDocumentoEmpresa, documento: string): string | null {
  const doc = normalizarDocumentoEmpresa(documento);
  if (!doc) return "Documento obligatorio";
  if (tipo === TIPOS_DOCUMENTO_EMPRESA.RUC) {
    return REGEX_RUC.test(doc) ? null : "RUC invalido (11 digitos)";
  }
  return REGEX_DOCUMENTO_EMPRESA.test(doc) ? null : "RUT/Documento invalido (alfanumerico, maximo 20)";
}

/** Etiqueta visible del tipo de documento de empresa (RUC o RUT/ID). */
export function etiquetaTipoDocumentoEmpresa(
  tipo: string | null | undefined,
  documento?: string | null,
): string {
  if (tipo === TIPOS_DOCUMENTO_EMPRESA.RUC) return "RUC";
  const normalizado = normalizarDocumentoEmpresa(documento);
  if (!tipo && /^\d{11}$/.test(normalizado)) return "RUC";
  if (/^\d{8}$/.test(normalizado)) return "DNI";
  return "RUT/ID";
}
