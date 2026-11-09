import { IGV_PORCENTAJE } from "@/lib/shared/constants";

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
    if (!Number.isFinite(cuota.monto)) continue;
    totalCents += aCentavos(cuota.monto);
    if (!Number.isSafeInteger(totalCents)) {
      throw new RangeError("Suma de cuotas fuera del rango seguro");
    }
  }
  return desdeCentavos(totalCents);
}
