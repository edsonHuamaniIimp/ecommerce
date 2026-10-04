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

/** Redondeo a 2 decimales (centavos). */
export function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Desglose de importes del contrato: los precios del sistema son **netos** y el
 * **IGV (18%) se agrega siempre** al total (factura y boleta).
 */
export function calcularImportes(neto: number): ImportesContrato {
  const valorVenta = redondear2(neto);
  const igv = redondear2(valorVenta * IGV_PORCENTAJE);
  return { valorVenta, igv, total: redondear2(valorVenta + igv) };
}
