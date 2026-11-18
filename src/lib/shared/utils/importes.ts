import { DESCUENTO_PORCENTAJE_MAX, DESCUENTO_PORCENTAJE_MIN, DESCUENTO_PORCENTAJE_PASO, IGV_PORCENTAJE } from "@/lib/shared/constants";

/** Desglose de importes del contrato (Anexo 2). */
export interface ImportesContrato {
  /** Precio neto (sin IGV). */
  valorVenta: number;
  /** IGV (18%) que se agrega al total. */
  igv: number;
  /** Total a pagar (neto + IGV). */
  total: number;
}

const CENTAVOS_POR_UNIDAD = 100;
const IGV_PORCENTAJE_ENTERO = Math.round(IGV_PORCENTAJE * 100);

/** Convierte un monto a centavos. Evita sumar floats sueltos. */
function aCentavos(valor: number): number {
  if (!Number.isFinite(valor)) {
    throw new TypeError("Monto monetario no finito");
  }
  const centavos = Math.round((valor + Number.EPSILON) * CENTAVOS_POR_UNIDAD);
  if (!Number.isSafeInteger(centavos)) {
    throw new RangeError("Monto monetario fuera del rango seguro");
  }
  return centavos;
}

function desdeCentavos(centavos: number): number {
  return centavos / CENTAVOS_POR_UNIDAD;
}

/** Redondeo monetario a 2 decimales (centavos), con correccion de binario. */
export function redondear2(valor: number): number {
  return desdeCentavos(aCentavos(valor));
}

/** Porcentaje de descuento valido: rango permitido y hasta 2 decimales. */
export function descuentoPorcentajeValido(porcentaje: number | null | undefined): porcentaje is number {
  if (typeof porcentaje !== "number" || !Number.isFinite(porcentaje)) return false;
  if (porcentaje < DESCUENTO_PORCENTAJE_MIN || porcentaje > DESCUENTO_PORCENTAJE_MAX) return false;
  const pasos = porcentaje / DESCUENTO_PORCENTAJE_PASO;
  return Math.abs(pasos - Math.round(pasos)) < 1e-9;
}

/** Monto fijo de descuento valido: no negativo, en centavos y no mayor al neto. */
export function descuentoMontoValido(neto: number, monto: number | null | undefined): monto is number {
  if (typeof monto !== "number" || !Number.isFinite(monto) || monto < 0) return false;
  if (!Number.isFinite(neto) || neto < 0 || monto > neto) return false;
  return Math.abs(monto - redondear2(monto)) < 1e-9;
}

/** Aplica el descuento sobre el neto y redondea una sola vez a centavos. */
export function aplicarDescuentoNeto(neto: number, porcentaje: number): number {
  if (!Number.isFinite(neto) || neto < 0) throw new TypeError("Neto monetario invalido");
  if (!descuentoPorcentajeValido(porcentaje)) throw new TypeError("Porcentaje de descuento invalido");
  return redondear2(neto * (1 - porcentaje / 100));
}

/** Aplica un descuento fijo al neto, validando que no supere el importe. */
export function aplicarDescuentoMonto(neto: number, monto: number): number {
  if (!Number.isFinite(neto) || neto < 0) throw new TypeError("Neto monetario invalido");
  if (!descuentoMontoValido(neto, monto)) throw new TypeError("Monto de descuento invalido");
  return redondear2(neto - monto);
}

/**
 * Desglose de importes del contrato: los precios del sistema son **netos** y el
 * **IGV (18%) se agrega siempre** al total (factura y boleta).
 */
export function calcularImportes(neto: number): ImportesContrato {
  if (!Number.isFinite(neto) || neto < 0) {
    throw new TypeError("El neto debe ser un monto finito y no negativo");
  }
  const valorVentaCents = aCentavos(neto);
  const baseIgv = valorVentaCents * IGV_PORCENTAJE_ENTERO;
  if (!Number.isSafeInteger(baseIgv)) {
    throw new RangeError("Calculo de IGV fuera del rango seguro");
  }
  const igvCents = Math.round(baseIgv / 100);
  return {
    valorVenta: desdeCentavos(valorVentaCents),
    igv: desdeCentavos(igvCents),
    total: desdeCentavos(valorVentaCents + igvCents),
  };
}

/**
 * Suma de montos de cuotas en centavos. Es el total que debe reflejar la
 * facturacion cuando existe un plan del contrato: sus montos ya incluyen IGV.
 */
export function sumarMontos(cuotas: Array<{ monto: number }>): number {
  let totalCents = 0;
  for (const cuota of cuotas) {
    if (!Number.isFinite(cuota.monto) || cuota.monto < 0) {
      throw new TypeError("Monto de cuota invalido");
    }
    totalCents += aCentavos(cuota.monto);
    if (!Number.isSafeInteger(totalCents)) {
      throw new RangeError("Suma de cuotas fuera del rango seguro");
    }
  }
  return desdeCentavos(totalCents);
}
