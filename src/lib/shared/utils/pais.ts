import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import es from "i18n-iso-countries/langs/es.json";
import { PAIS_DEFAULT, REGEX_PAIS } from "@/lib/shared/constants";
import { normalizarTexto } from "@/lib/shared/utils/normalizar-texto";

countries.registerLocale(es);
countries.registerLocale(en);

/** Gentilicios habituales (masculino/femenino) por codigo ISO alpha-2. */
const GENTILICIOS: Record<string, string[]> = {
  PE: ["peruano", "peruana"],
  CL: ["chileno", "chilena"],
  AR: ["argentino", "argentina"],
  CO: ["colombiano", "colombiana"],
  EC: ["ecuatoriano", "ecuatoriana"],
  BO: ["boliviano", "boliviana"],
  BR: ["brasileno", "brasilena", "brazilian"],
  UY: ["uruguayo", "uruguaya"],
  PY: ["paraguayo", "paraguaya"],
  VE: ["venezolano", "venezolana"],
  MX: ["mexicano", "mexicana"],
  PA: ["panameno", "panamena"],
  CR: ["costarricense"],
  CU: ["cubano", "cubana"],
  DO: ["dominicano", "dominicana"],
  GT: ["guatemalteco", "guatemalteca"],
  HN: ["hondureno", "hondurena"],
  SV: ["salvadoreno", "salvadorena"],
  NI: ["nicaraguense"],
  US: ["estadounidense", "norteamericano", "norteamericana", "americano", "americana", "american"],
  CA: ["canadiense", "canadian"],
  ES: ["espanol", "espanola", "spanish"],
  FR: ["frances", "francesa", "french"],
  DE: ["aleman", "alemana", "german"],
  IT: ["italiano", "italiana", "italian"],
  PT: ["portugues", "portuguesa", "portuguese"],
  GB: ["britanico", "britanica", "ingles", "inglesa", "british", "english"],
  IE: ["irlandes", "irlandesa", "irish"],
  NL: ["holandes", "holandesa", "neerlandes", "neerlandesa", "dutch"],
  BE: ["belga", "belgian"],
  CH: ["suizo", "suiza", "swiss"],
  SE: ["sueco", "sueca", "swedish"],
  NO: ["noruego", "noruega", "norwegian"],
  DK: ["danes", "danesa", "danish"],
  FI: ["finlandes", "finlandesa", "finnish"],
  PL: ["polaco", "polaca", "polish"],
  RU: ["ruso", "rusa", "russian"],
  CN: ["chino", "china", "chinese"],
  JP: ["japones", "japonesa", "japanese"],
  KR: ["coreano", "coreana", "korean", "surcoreano", "surcoreana"],
  IN: ["indio", "india", "indian"],
  AU: ["australiano", "australiana", "australian"],
  ZA: ["sudafricano", "sudafricana"],
  TR: ["turco", "turca", "turkish"],
  IL: ["israeli", "israelita"],
  AE: ["emirati"],
  SA: ["saudita", "saudi"],
};

/** Indice normalizado: nombre (es/en), alternativos, ISO-3 y gentilicios -> alpha-2. */
function construirIndice(): Map<string, string> {
  const indice = new Map<string, string>();
  const agregar = (clave: string, codigo: string) => {
    const normalizada = normalizarTexto(clave);
    if (normalizada && !indice.has(normalizada)) indice.set(normalizada, codigo);
  };
  for (const lang of ["es", "en"] as const) {
    for (const [codigo, nombres] of Object.entries(countries.getNames(lang, { select: "all" }))) {
      for (const nombre of nombres as string[]) agregar(nombre, codigo);
    }
  }
  for (const [codigo, terminos] of Object.entries(GENTILICIOS)) {
    for (const termino of terminos) agregar(termino, codigo);
  }
  return indice;
}

const INDICE = construirIndice();

/**
 * Mapper de pais: convierte codigo ISO (2 o 3 letras), nombre (espanol/ingles, con o
 * sin tilde) o gentilicio ("Peruana") al codigo ISO alpha-2. Devuelve `null` si el
 * valor esta vacio o no se reconoce.
 */
export function paisDeTexto(valor: string | null | undefined): string | null {
  const texto = valor?.trim();
  if (!texto) return null;

  const mayusculas = texto.toUpperCase();
  if (REGEX_PAIS.test(mayusculas) && countries.isValid(mayusculas)) return mayusculas;
  if (/^[A-Z]{3}$/.test(mayusculas)) {
    const alpha2 = countries.alpha3ToAlpha2(mayusculas);
    if (alpha2) return alpha2;
  }
  return INDICE.get(normalizarTexto(texto)) ?? null;
}

/** Opcion de pais para filtros con conteo opcional de registros. */
export interface PaisOpcion {
  codigo: string;
  nombre: string;
  conteo?: number;
}

/**
 * Ordena paises para un filtro: primero los que tienen registros (mayor conteo
 * primero) y luego los que no. Los empates se resuelven alfabeticamente.
 */
export function ordenarPaisesPorConteo<T extends PaisOpcion>(paises: T[]): T[] {
  return [...paises].sort((a, b) => {
    const conteoA = a.conteo ?? 0;
    const conteoB = b.conteo ?? 0;
    if ((conteoA > 0) !== (conteoB > 0)) return conteoA > 0 ? -1 : 1;
    if (conteoA !== conteoB) return conteoB - conteoA;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

/** Nombre del pais en espanol; si el codigo no existe devuelve el propio codigo. */
export function nombrePais(codigo: string | null | undefined): string {
  if (!codigo) return "";
  return countries.getName(codigo, "es") ?? codigo;
}

/** true cuando el codigo corresponde al pais de la organizacion (Peru). */
export function esPaisNacional(codigo: string | null | undefined): boolean {
  return codigo === PAIS_DEFAULT;
}
