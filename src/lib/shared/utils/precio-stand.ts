import { MONEDAS, PRECIO_STAND_DEFAULT, PRECIOS_STAND_POR_TIPO } from "@/lib/shared/constants";
import { numberUtils } from "./number";

/** Normaliza el tipo de stand: mayusculas y sin espacios ("E STANDAR_01" -> "ESTANDAR_01"). */
function normalizarTipo(tipo: string): string {
  return tipo.toUpperCase().replace(/\s+/g, "");
}

/** Claves del catalogo de mas especifica a mas generica (evita "ESTANDAR" antes de "ESTANDAR_01"). */
const CLAVES_PRECIO = Object.keys(PRECIOS_STAND_POR_TIPO).sort((a, b) => b.length - a.length);

/** Monto (USD) de un tipo de stand; `null` si no hay tipo informado. */
export function precioNumericoDesdeTipo(tipoStand: string | null | undefined): number | null {
  const tipo = normalizarTipo(String(tipoStand ?? ""));
  if (!tipo) return null;
  const clave = CLAVES_PRECIO.find((k) => tipo === k || tipo.startsWith(k));
  return clave ? (PRECIOS_STAND_POR_TIPO[clave] ?? PRECIO_STAND_DEFAULT) : PRECIO_STAND_DEFAULT;
}

/** Texto de precio con el formato historico de `medidas` (ej. "12000.00 US$"). */
export function precioTextoDesdeTipo(tipoStand: string | null | undefined): string {
  const monto = precioNumericoDesdeTipo(tipoStand) ?? PRECIO_STAND_DEFAULT;
  return `${monto.toFixed(2)} ${MONEDAS.US_DOLAR}`;
}

/** Formato de presentacion (ej. "US$ 12,000.00"). */
export function precioTexto(monto: number): string {
  return numberUtils.monto(monto, MONEDAS.US_DOLAR, { decimales: 2 });
}

/** Stand con los campos necesarios para resolver su precio. */
export interface PrecioStandFuente {
  medidas?: string | null;
  tipoStand?: string | null;
  rawData?: unknown;
}

/** Stand apto para reserva administrativa: activo, vinculado a 3D y con precio comercial explícito. */
export interface StandReservableFuente extends PrecioStandFuente {
  bloqueId?: string | null;
  flgActivo?: boolean;
}

/** Numero extraido de `medidas` solo cuando el texto es un precio (no una medida tipo "3x3"). */
function numeroDesdeMedidas(medidas: string | null | undefined): number | null {
  const texto = String(medidas ?? "").trim();
  if (!texto) return null;
  const esPrecio = /US\$|USD|PEN|S\/|SOLES|\$/i.test(texto) || /^[\d.,]+$/.test(texto);
  if (!esPrecio) return null;
  const num = parseFloat(texto.replace(/[^0-9.]/g, ""));
  return Number.isFinite(num) ? num : null;
}

/** Numero desde el payload externo (`rawData.monto | precio | importe`). */
function numeroDesdeRawData(rawData: unknown): number | null {
  if (!rawData || typeof rawData !== "object") return null;
  const raw = rawData as Record<string, unknown>;
  const candidato = raw.monto ?? raw.precio ?? raw.importe;
  if (candidato === null || candidato === undefined) return null;
  const num = Number(String(candidato).replace(/[^0-9.]/g, ""));
  return Number.isFinite(num) ? num : null;
}

/**
 * Precio informado explÃ­citamente por el API/BD, incluyendo el valor 0.00.
 * Devuelve null cuando el stand no trae ningÃºn dato de precio.
 */
export function precioComercialExplicito(stand: PrecioStandFuente): number | null {
  const desdeMedidas = numeroDesdeMedidas(stand.medidas);
  if (desdeMedidas !== null) return desdeMedidas;
  return numeroDesdeRawData(stand.rawData);
}

/**
 * Un stand es vinculable comercialmente si no trae un precio explÃ­cito invÃ¡lido.
 * Los registros del API con `0.00` son datos incompletos/duplicados y no deben
 * poder asociarse a un bloque 3D.
 */
export function esStandComercialVinculable(stand: PrecioStandFuente): boolean {
  const precio = precioComercialExplicito(stand);
  return precio === null || precio > 0;
}

/**
 * Un stand solo puede reservarse administrativamente si tiene bloque 3D y un
 * precio comercial explícito mayor a 0. No se usa el catálogo como respaldo.
 */
export function esStandComercialReservable(stand: StandReservableFuente): boolean {
  return stand.flgActivo !== false
    && Boolean(stand.bloqueId)
    && (precioComercialExplicito(stand) ?? 0) > 0;
}

/**
 * Precio para reportes: respeta el 0.00 explícito y solo usa el catálogo
 * cuando el stand realmente no informa precio.
 */
export function resolverPrecioComercialStand(stand: PrecioStandFuente): number {
  const explicito = precioComercialExplicito(stand);
  if (explicito !== null) return explicito;
  return precioNumericoDesdeTipo(stand.tipoStand) ?? PRECIO_STAND_DEFAULT;
}

/**
 * Resuelve el precio (USD) de un stand. Prioridad:
 *  1. `medidas` cuando es un texto de precio ("2000.00 US$", "1200"), no una medida ("3x3").
 *  2. `rawData.monto | rawData.precio | rawData.importe` (payload de la API externa).
 *  3. Catalogo por tipo (`PRECIOS_STAND_POR_TIPO`), con default para tipos desconocidos.
 */
export function resolverPrecioStand(stand: PrecioStandFuente): number {
  const desdeMedidas = numeroDesdeMedidas(stand.medidas);
  if (desdeMedidas !== null && desdeMedidas > 0) return desdeMedidas;

  const desdeRaw = numeroDesdeRawData(stand.rawData);
  if (desdeRaw !== null && desdeRaw > 0) return desdeRaw;

  return precioNumericoDesdeTipo(stand.tipoStand) ?? PRECIO_STAND_DEFAULT;
}
