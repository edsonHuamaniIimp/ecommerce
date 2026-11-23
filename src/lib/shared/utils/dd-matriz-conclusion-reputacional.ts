import {
  DD_MATRIZ_CONCLUSIONES,
  DD_REPUTACION_RESULTADOS,
} from "@/lib/shared/constants";
import { ddUtils } from "@/lib/shared/utils/debida-diligencia";

const esAceptado = (resultado: string | null | undefined) =>
  ddUtils.normalizarResultadoReputacion(resultado) === DD_REPUTACION_RESULTADOS.ACEPTADO;

/**
 * Conclusion reputacional (que define SIG) que debe quedar guardada cuando Comunicaciones cierra un
 * vinculo con `nuevoResultado`. Devuelve `undefined` si no hay que tocarla.
 *
 * - Aceptado y sin conclusion previa: "sin observaciones" por defecto (SIG puede cambiarla).
 * - Pasa de aceptado a observado y la conclusion era la automatica: se limpia para que SIG decida.
 * - Cualquier otra conclusion ya registrada por SIG se respeta.
 */
export function conclusionReputacionalTrasResultado(
  actual: { resultado: string | null; conclusion: string | null },
  nuevoResultado: string,
): string | null | undefined {
  if (esAceptado(nuevoResultado)) {
    return actual.conclusion ? undefined : DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES;
  }
  if (
    esAceptado(actual.resultado) &&
    actual.conclusion === DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES
  ) {
    return null;
  }
  return undefined;
}
