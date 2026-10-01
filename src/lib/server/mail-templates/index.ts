import { idiomaODefecto } from "@/lib/shared/utils/idioma";
import { plantillasEs } from "./es";
import { plantillasEn } from "./en";
import type { DatosPlantilla, PlantillaEmail, PlantillaEmailKind } from "./tipos";

export type { DatosPlantilla, PlantillaEmail, PlantillaEmailKind } from "./tipos";

const PAQUETES: Record<string, typeof plantillasEs> = {
  es: plantillasEs,
  en: plantillasEn,
};

/**
 * Resuelve la plantilla de correo del idioma indicado (fallback español).
 * Uso: `getPlantillaEmail("credenciales-empresa", idioma, datos)`.
 */
export function getPlantillaEmail<K extends PlantillaEmailKind>(
  kind: K,
  idioma: string | null | undefined,
  datos: DatosPlantilla[K],
): PlantillaEmail {
  const paquete = PAQUETES[idiomaODefecto(idioma)] ?? plantillasEs;
  const constructor = paquete[kind] as unknown as (d: DatosPlantilla[K]) => PlantillaEmail;
  return constructor(datos);
}
