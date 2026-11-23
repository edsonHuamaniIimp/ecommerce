import {
  DD_MATRIZ_TIPO_VINCULO_EMPRESA_VINCULADA_LABEL,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_MATRIZ_TIPO_VINCULO_PERSONA_VINCULADA_LABEL,
  DD_MATRIZ_TIPOS_VINCULO,
  DD_TIPOS_DOCUMENTO_VINCULO,
} from "@/lib/shared/constants";
import type { DdMatrizTipoVinculo } from "@/lib/shared/constants";

export interface DdVinculoVista {
  tipo: string;
  tipoDocumento?: string | null;
}

/** El vinculo es una empresa: la fila de la empresa o una "vinculada" declarada con RUC. */
export function esVinculoEmpresa(vinculo: DdVinculoVista): boolean {
  if (vinculo.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA) return true;
  return (
    vinculo.tipo === DD_MATRIZ_TIPOS_VINCULO.VINCULADO &&
    vinculo.tipoDocumento === DD_TIPOS_DOCUMENTO_VINCULO.RUC
  );
}

/**
 * Etiqueta del tipo de vinculo. Un "vinculado" se muestra como empresa o persona segun su documento;
 * si no hay documento se conserva la etiqueta generica.
 */
export function etiquetaTipoVinculo(vinculo: DdVinculoVista): string {
  if (vinculo.tipo === DD_MATRIZ_TIPOS_VINCULO.VINCULADO) {
    if (vinculo.tipoDocumento === DD_TIPOS_DOCUMENTO_VINCULO.RUC) return DD_MATRIZ_TIPO_VINCULO_EMPRESA_VINCULADA_LABEL;
    if (vinculo.tipoDocumento) return DD_MATRIZ_TIPO_VINCULO_PERSONA_VINCULADA_LABEL;
  }
  return DD_MATRIZ_TIPO_VINCULO_LABELS[vinculo.tipo as DdMatrizTipoVinculo] ?? vinculo.tipo;
}
