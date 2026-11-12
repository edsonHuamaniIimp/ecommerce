import { TIPOS_ARCHIVO_IIMP, type TipoArchivoIImp } from "@/lib/shared/constants";

/** Declaracion de requisitos de facturacion hecha por el cliente al solicitar. */
export interface RequisitosFacturacionDeclarados {
  oc?: boolean;
  hes?: boolean;
  plataforma?: boolean;
  plataformaNombre?: string | null;
  plataformaUrl?: string | null;
  valorizacion?: boolean;
  otros?: string | null;
  ninguna?: boolean;
  cuota?: number;
}

/** true si el cliente no marco ningun requisito ni "Ninguna de las anteriores". */
export function requisitosVacios(
  requisitos: RequisitosFacturacionDeclarados | null | undefined,
): boolean {
  if (!requisitos) return true;
  return (
    !requisitos.oc &&
    !requisitos.hes &&
    !requisitos.plataforma &&
    !requisitos.valorizacion &&
    !(requisitos.otros ?? "").trim() &&
    !requisitos.ninguna
  );
}

/** Tipos documentales exigidos por la declaracion del cliente (sin constancias de pago). */
export function tiposRequeridosPorRequisitos(  requisitos: RequisitosFacturacionDeclarados | null | undefined,
): TipoArchivoIImp[] {
  if (!requisitos || requisitos.ninguna) return [];
  const tipos: TipoArchivoIImp[] = [];
  if (requisitos.oc) tipos.push(TIPOS_ARCHIVO_IIMP.OC);
  if (requisitos.hes) tipos.push(TIPOS_ARCHIVO_IIMP.HES);
  if (requisitos.valorizacion) tipos.push(TIPOS_ARCHIVO_IIMP.VALORIZACION_COTIZACION);
  if (requisitos.otros) tipos.push(TIPOS_ARCHIVO_IIMP.OTROS_REQUISITOS);
  return tipos;
}

/**
 * Tipos habilitados en el panel "Documentos para tu factura": los requisitos
 * declarados (OC/HES/valorizacion/otros) mas las constancias de pago. Sin
 * declaracion se ofrecen todos los tipos documentales.
 */
export function tiposDocumentosPorRequisitos(
  requisitos: RequisitosFacturacionDeclarados | null | undefined,
): TipoArchivoIImp[] {
  const pagos: TipoArchivoIImp[] = [
    TIPOS_ARCHIVO_IIMP.DETRACCION,
    TIPOS_ARCHIVO_IIMP.DIFERENCIA,
    TIPOS_ARCHIVO_IIMP.PAGO_TOTAL,
  ];
  if (!requisitos) {
    return [TIPOS_ARCHIVO_IIMP.OC, TIPOS_ARCHIVO_IIMP.HES, TIPOS_ARCHIVO_IIMP.VALORIZACION_COTIZACION, ...pagos];
  }
  if (requisitos.ninguna) return pagos;
  return [...tiposRequeridosPorRequisitos(requisitos), ...pagos];
}

/** Etiquetas legibles de los tipos de archivo de la cuenta corriente del IIMP. */
export const TIPOS_ARCHIVO_IIMP_LABELS: Record<string, string> = {
  [TIPOS_ARCHIVO_IIMP.OC]: "Orden de compra (OC)",
  [TIPOS_ARCHIVO_IIMP.HES]: "Hoja de entrada (HES)",
  [TIPOS_ARCHIVO_IIMP.DETRACCION]: "Constancia de detracción",
  [TIPOS_ARCHIVO_IIMP.DIFERENCIA]: "Pago del saldo",
  [TIPOS_ARCHIVO_IIMP.PAGO_TOTAL]: "Pago total",
  [TIPOS_ARCHIVO_IIMP.VALORIZACION_COTIZACION]: "Valorización / cotización",
  [TIPOS_ARCHIVO_IIMP.OTROS_REQUISITOS]: "Otros requisitos",
};
