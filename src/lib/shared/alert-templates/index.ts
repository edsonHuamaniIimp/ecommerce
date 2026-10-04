import { IDIOMAS } from "@/lib/shared/constants";
import { idiomaODefecto } from "@/lib/shared/utils/idioma";
import { PLANTILLAS_ALERTA_EN } from "./en";
import { PLANTILLAS_ALERTA_ES } from "./es";
import type { AlertaClave, AlertaDatosMap, AlertaPlantilla } from "./tipos";

export { ALERTA_CLAVES } from "./tipos";
export type { AlertaClave, AlertaDatos, AlertaDatosMap, AlertaPlantilla } from "./tipos";

/** Resuelve la plantilla de una alerta en el idioma pedido (fallback español). */
export function getAlertaPlantilla<K extends AlertaClave>(
  clave: K,
  idioma: string | null | undefined,
  datos: AlertaDatosMap[K],
): AlertaPlantilla | null {
  const plantillas = idiomaODefecto(idioma) === IDIOMAS.EN ? PLANTILLAS_ALERTA_EN : PLANTILLAS_ALERTA_ES;
  const render = plantillas[clave] as ((d: AlertaDatosMap[K]) => AlertaPlantilla) | undefined;
  return render ? render(datos) : null;
}

/**
 * Titulo/mensaje de una alerta en el idioma del destinatario. Si la fila no tiene
 * plantilla (`clave` nula o desconocida) se devuelve el texto guardado (legacy).
 */
export function localizarAlerta(
  alerta: { clave?: string | null; datos?: unknown; titulo: string; mensaje: string },
  idioma: string | null | undefined,
): AlertaPlantilla {
  if (!alerta.clave) return { titulo: alerta.titulo, mensaje: alerta.mensaje };
  const plantilla = getAlertaPlantilla(alerta.clave as AlertaClave, idioma, (alerta.datos ?? {}) as never);
  return plantilla ?? { titulo: alerta.titulo, mensaje: alerta.mensaje };
}
