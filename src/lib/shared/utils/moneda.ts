import { MONEDAS } from "@/lib/shared/constants";
import { calcularImportes, redondear2, type ImportesContrato } from "./importes";
import { numberUtils } from "./number";

/** Monedas disponibles para una solicitud/contrato. */
export const MONEDAS_CONTRATO = {
  USD: MONEDAS.USD,
  PEN: MONEDAS.PEN,
} as const;

export type MonedaContrato = (typeof MONEDAS_CONTRATO)[keyof typeof MONEDAS_CONTRATO];

/** Limites del tipo de cambio (soles por dolar). */
export const TIPO_CAMBIO_MAX = 100;
/** Escala usada para convertir sin aritmetica de floats (4 decimales). */
const ESCALA_TIPO_CAMBIO = 10_000;
const CENTAVOS_POR_UNIDAD = 100;

export function esMonedaContrato(value: unknown): value is MonedaContrato {
  return value === MONEDAS_CONTRATO.USD || value === MONEDAS_CONTRATO.PEN;
}

/** Simbolo de presentacion (el codigo ISO se guarda en BD). */
export function simboloMoneda(moneda: string | null | undefined): string {
  return moneda === MONEDAS_CONTRATO.PEN ? MONEDAS.SOL : MONEDAS.US_DOLAR;
}

/** Etiqueta para textos legales/cuentas bancarias (USD | S/.). */
export function etiquetaMoneda(moneda: string | null | undefined): string {
  return moneda === MONEDAS_CONTRATO.PEN ? MONEDAS.SOL : MONEDAS.USD;
}

/** Tipo de cambio valido: soles por dolar, mayor a cero y dentro del limite. */
export function tipoCambioValido(tipoCambio: number | null | undefined): tipoCambio is number {
  return typeof tipoCambio === "number"
    && Number.isFinite(tipoCambio)
    && tipoCambio > 0
    && tipoCambio <= TIPO_CAMBIO_MAX;
}

function aCentavos(valor: number): number {
  const centavos = Math.round((valor + Number.EPSILON) * CENTAVOS_POR_UNIDAD);
  if (!Number.isSafeInteger(centavos)) {
    throw new RangeError("Monto monetario fuera del rango seguro");
  }
  return centavos;
}

/**
 * Convierte el precio neto base (USD) a la moneda del contrato.
 * La conversion se hace antes del IGV; el IGV se calcula sobre el neto convertido.
 *
 * Se trabaja en centavos y con el TC escalado a 4 decimales para no arrastrar
 * errores de coma flotante en la cadena precio -> cuotas -> contrato.
 */
export function convertirNeto(
  netoUsd: number,
  moneda: string | null | undefined,
  tipoCambio: number | null | undefined,
): number {
  if (!Number.isFinite(netoUsd) || netoUsd < 0) {
    throw new TypeError("El neto en USD debe ser un monto finito y no negativo");
  }
  if (moneda !== MONEDAS_CONTRATO.PEN) {
    return redondear2(netoUsd);
  }
  if (!tipoCambioValido(tipoCambio)) {
    throw new Error("El evento no tiene un tipo de cambio valido para soles.");
  }
  const netoCents = aCentavos(netoUsd);
  const tipoCambioEscalado = Math.round((tipoCambio + Number.EPSILON) * ESCALA_TIPO_CAMBIO);
  const producto = netoCents * tipoCambioEscalado;
  if (!Number.isSafeInteger(producto)) {
    throw new RangeError("Conversion monetaria fuera del rango seguro");
  }
  const netoPenCents = Math.round(producto / ESCALA_TIPO_CAMBIO);
  return netoPenCents / CENTAVOS_POR_UNIDAD;
}

export function importesEnMoneda(
  netoUsd: number,
  moneda: string | null | undefined,
  tipoCambio: number | null | undefined,
): ImportesContrato & { neto: number } {
  const neto = convertirNeto(netoUsd, moneda, tipoCambio);
  return { neto, ...calcularImportes(neto) };
}

/** Cuentas bancarias del Anexo 2 segun la moneda del contrato. */
export const CUENTAS_CONTRATO: Record<MonedaContrato, {
  cuentaCorriente: string;
  cuentaInterbancaria: string;
  cuentaDetraccion: string;
  tipoCuenta: string;
}> = {
  [MONEDAS_CONTRATO.USD]: {
    cuentaCorriente: "191-2654294-1-59",
    cuentaInterbancaria: "002-191-002654294159-51",
    cuentaDetraccion: "000-00-372668",
    tipoCuenta: "dólares americanos",
  },
  [MONEDAS_CONTRATO.PEN]: {
    cuentaCorriente: "191-2654259-0-95",
    cuentaInterbancaria: "002-191-002654259095-50",
    cuentaDetraccion: "000-00372668",
    tipoCuenta: "soles",
  },
};

/** Precio de una solicitud: base USD convertida a la moneda guardada. */
export function formatearPrecioSolicitud(
  precioUsd: number,
  moneda: string | null | undefined,
  tipoCambio: number | null | undefined,
  opciones?: { decimales?: number; idioma?: string | null },
): string {
  try {
    return formatearMonto(convertirNeto(precioUsd, moneda, tipoCambio), moneda, opciones);
  } catch {
    return formatearMonto(precioUsd, MONEDAS_CONTRATO.USD, opciones);
  }
}

export function formatearMonto(
  monto: number,
  moneda: string | null | undefined,
  opciones?: { decimales?: number; idioma?: string | null },
): string {
  return numberUtils.monto(monto, simboloMoneda(moneda), opciones);
}
