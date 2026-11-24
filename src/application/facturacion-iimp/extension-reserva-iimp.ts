import { MONEDAS, TIPOS_DESCUENTO, TIPOS_SOLICITUD } from "@/lib/shared/constants";
import type { PlanCuotasSolicitud } from "@/domain/models/entities";
import type {
  ReservaIimpComercial,
  ReservaIimpCuotaInput,
  ReservaIimpInput,
  ReservaIimpOrigen,
  ReservaIimpRequisitos,
  ReservaIimpStandDetalle,
} from "@/domain/ports/reserva-iimp-client";

/** Tasa de IGV que la web aplica al plan (porcentaje). */
const TASA_IGV = 18;
const SISTEMA_ORIGEN = "CONTRATOS_STANDS";

/** Tipos de descuento del contrato en el vocabulario del IIMP. */
const TIPO_DESCUENTO_IIMP = {
  NINGUNO: "NINGUNO",
  [TIPOS_DESCUENTO.PORCENTAJE]: "PORCENTAJE",
  [TIPOS_DESCUENTO.MONTO]: "MONTO",
  [TIPOS_DESCUENTO.POR_STAND]: "POR_STAND",
} as const;

const aCentavos = (valor: number): number => Math.round((valor + Number.EPSILON) * 100);
const decimal = (centavos: number): string => (centavos / 100).toFixed(2);

export interface ContextoExtensionReserva {
  moneda: string;
  tipoCambio: number | null;
  plan: PlanCuotasSolicitud | null;
  /** Cuotas ya redondeadas a porcentajes enteros (las que viajan al IIMP). */
  cuotas: ReservaIimpCuotaInput[];
  /** Solicitud interna: agrega el bloque extra (comercial, importes, requisitos, origen). */
  interna: boolean;
  requisitos: ReservaIimpRequisitos | null;
  origen: Omit<ReservaIimpOrigen, "sistema" | "registradoEn"> | null;
  ahora: Date;
}

/** Tipo de cambio pactado: `1.0000` en USD; en PEN el del plan (o el de la solicitud). */
export function tipoCambioPactado(moneda: string, tipoCambio: number | null | undefined): string | null {
  if (moneda !== MONEDAS.PEN) return "1.0000";
  return tipoCambio && Number.isFinite(tipoCambio) && tipoCambio > 0 ? tipoCambio.toFixed(4) : null;
}

/**
 * Reparte base e IGV por cuota desde el monto con IGV del plan. La ultima cuota
 * absorbe los centavos para que la suma de bases sea exactamente la base del contrato.
 */
export function importesPorCuota(
  montosConIgv: number[],
  baseContrato: number,
): Array<{ baseImponible: string; igv: string; monto: string }> {
  const baseTotal = aCentavos(baseContrato);
  let acumulado = 0;
  return montosConIgv.map((monto, i) => {
    const montoC = aCentavos(monto);
    const esUltima = i === montosConIgv.length - 1;
    const baseC = esUltima ? baseTotal - acumulado : Math.round((montoC * 100) / (100 + TASA_IGV));
    acumulado += baseC;
    return { baseImponible: decimal(baseC), igv: decimal(montoC - baseC), monto: decimal(montoC) };
  });
}

/**
 * Campos que se agregan al payload de la reserva: `TipoCambio` para toda solicitud y,
 * en las internas, el bloque comercial/cuotas/requisitos/origen (propuesta al SIE).
 * Devuelve `{}` si el plan no tiene los datos necesarios (se envia el payload clasico).
 */
export function extensionReserva(ctx: ContextoExtensionReserva): Partial<ReservaIimpInput> {
  const tipoCambio = tipoCambioPactado(ctx.moneda, ctx.plan?.tipoCambio ?? ctx.tipoCambio);
  const extra: Partial<ReservaIimpInput> = tipoCambio ? { tipoCambio } : {};
  const plan = ctx.plan;
  if (!ctx.interna || !plan || plan.cuotas.length === 0) return extra;
  if (typeof plan.total !== "number" || typeof plan.igv !== "number" || typeof plan.netoLista !== "number") return extra;

  const base = typeof plan.netoDescontado === "number" ? plan.netoDescontado : plan.total - plan.igv;
  const descuentoTotal = typeof plan.descuentoMonto === "number" ? plan.descuentoMonto : plan.netoLista - base;
  const tipoDescuento =
    descuentoTotal > 0.004 ? (TIPO_DESCUENTO_IIMP[plan.descuentoTipo ?? TIPOS_DESCUENTO.PORCENTAJE] ?? TIPO_DESCUENTO_IIMP.NINGUNO) : TIPO_DESCUENTO_IIMP.NINGUNO;

  const comercial: ReservaIimpComercial = {
    tipoDescuento,
    sumaLista: decimal(aCentavos(plan.netoLista)),
    descuentoTotal: decimal(aCentavos(descuentoTotal)),
    baseImponible: decimal(aCentavos(base)),
    tasaIgv: TASA_IGV.toFixed(2),
    igv: decimal(aCentavos(plan.igv)),
    total: decimal(aCentavos(plan.total)),
  };

  const importes = importesPorCuota(plan.cuotas.map((c) => c.monto), base);
  const cuotas = ctx.cuotas.map((c, i) => ({ ...c, ...(importes[i] ?? {}) }));

  const standsDetalle: ReservaIimpStandDetalle[] = (plan.descuentosPorStand ?? [])
    .filter((s) => s.standCode)
    .map((s) => ({
      numero: String(s.standCode),
      precioLista: decimal(aCentavos(s.precio)),
      descuentoPorcentaje: (s.porcentaje ?? 0).toFixed(2),
      descuentoMonto: decimal(aCentavos(s.descuentoMonto)),
      precioNeto: decimal(aCentavos(s.neto)),
    }));

  return {
    ...extra,
    comercial,
    cuotas,
    ...(standsDetalle.length > 0 ? { standsDetalle } : {}),
    ...(plan.modalidad ? { modalidad: plan.modalidad } : {}),
    ...(ctx.requisitos ? { requisitos: ctx.requisitos } : {}),
    origen: {
      sistema: SISTEMA_ORIGEN,
      tipoSolicitud: TIPOS_SOLICITUD.RESERVA_EMPRESA.toUpperCase(),
      registradoPor: ctx.origen?.registradoPor ?? null,
      registradoEn: ctx.ahora.toISOString(),
      programadaPara: ctx.origen?.programadaPara ?? null,
    },
  };
}
