import { API_ERROR_CODES, MONEDAS, TIPOS_DESCUENTO, TIPOS_SOLICITUD } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import { convertirNeto } from "@/lib/shared/utils/moneda";
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
/** Tolerancias del SIE (centavos): sumas 0.02, base de la cuota vs su porcentaje 0.05. */
const TOLERANCIA_SUMA_C = 2;
const TOLERANCIA_CUOTA_C = 5;

/** Tipos de descuento del contrato en el vocabulario del IIMP. */
const TIPO_DESCUENTO_IIMP = {
  NINGUNO: "NINGUNO",
  [TIPOS_DESCUENTO.PORCENTAJE]: "PORCENTAJE",
  [TIPOS_DESCUENTO.MONTO]: "MONTO",
  [TIPOS_DESCUENTO.POR_STAND]: "POR_STAND",
} as const;

const aCentavos = (valor: number): number => Math.round((valor + Number.EPSILON) * 100);
const decimal = (centavos: number): string => (centavos / 100).toFixed(2);

/** Porcentaje en 2 decimales si alcanza; si no, en 4 (el SIE valida monto = % de la lista). */
function porcentajeTexto(valor: number): string {
  const dos = valor.toFixed(2);
  return Math.abs(Number(dos) - valor) < 1e-9 ? dos : valor.toFixed(4);
}

function invalido(mensaje: string): DomainError {
  return new DomainError(mensaje, API_ERROR_CODES.VALIDATION, 400);
}

export interface StandPrecioReserva {
  /** Codigo con el que el stand viaja en `Stands`. */
  codigo: string;
  /** Codigo comercial (el que usa el plan en `descuentosPorStand`). */
  standCode: string;
  /** Precio de lista en USD. */
  precioUsd: number;
}

export interface ContextoExtensionReserva {
  moneda: string;
  tipoCambio: number | null;
  plan: PlanCuotasSolicitud | null;
  /** Cuotas ya redondeadas a porcentajes enteros (las que viajan al IIMP). */
  cuotas: ReservaIimpCuotaInput[];
  stands: StandPrecioReserva[];
  /** Solicitud interna: agrega ademas requisitos, modalidad y origen. */
  interna: boolean;
  requisitos: ReservaIimpRequisitos | null;
  origen: Omit<ReservaIimpOrigen, "sistema" | "registradoEn"> | null;
  ahora: Date;
  /**
   * Consulta de solo lectura del SIE: devuelve SIEMPRE `Comercial`, importes por cuota, `StandsDetalle`
   * y `Modalidad` (tambien en USD, sin descuento y en solicitudes no internas) y el tipo de cambio REAL
   * (en USD el del evento, nunca 1). El envio de la reserva no usa esta opcion.
   */
  lecturaSie?: boolean;
  /** Tipo de cambio actual del evento (soles por dolar); lo usa la lectura del SIE en solicitudes USD. */
  tipoCambioEvento?: number | null;
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
 * Precio pactado de CADA stand de la reserva (el SIE lo exige con soles o con cualquier
 * descuento): lista en la moneda del contrato, descuento y neto. Con descuento por stand
 * usa el plan; con descuento global lo reparte proporcionalmente (el ultimo absorbe los
 * centavos). Valida que sume la lista y la base del contrato.
 */
export function detalleStandsReserva(
  plan: PlanCuotasSolicitud,
  stands: StandPrecioReserva[],
  moneda: string,
  tipoCambio: number | null,
  sumaListaC: number,
  baseC: number,
): ReservaIimpStandDetalle[] {
  if (stands.length === 0) throw invalido("No se pudo armar el detalle de precios por stand de la solicitud.");
  const porStand = new Map((plan.descuentosPorStand ?? []).map((d) => [String(d.standCode ?? ""), d]));
  const listasC = stands.map((s) => {
    const d = porStand.get(s.standCode);
    return aCentavos(d ? d.precio : convertirNeto(s.precioUsd, moneda, tipoCambio));
  });
  const sumaC = listasC.reduce((a, b) => a + b, 0);
  if (Math.abs(sumaC - sumaListaC) > TOLERANCIA_SUMA_C) {
    throw invalido(
      `La lista de precios de los stands (${decimal(sumaC)}) no coincide con la del contrato (${decimal(sumaListaC)}). Actualiza la solicitud antes de enviarla.`,
    );
  }

  const descuentoTotalC = sumaListaC - baseC;
  let acumulado = 0;
  const detalle = stands.map((s, i) => {
    const listaC = listasC[i] ?? 0;
    const d = porStand.get(s.standCode);
    const esUltimo = i === stands.length - 1;
    let descC: number;
    if (plan.descuentosPorStand && plan.descuentosPorStand.length > 0) {
      descC = d ? aCentavos(d.descuentoMonto) : 0;
    } else {
      descC = esUltimo ? descuentoTotalC - acumulado : Math.round((listaC * descuentoTotalC) / (sumaListaC || 1));
    }
    acumulado += descC;
    return {
      numero: s.codigo,
      precioLista: decimal(listaC),
      descuentoPorcentaje: porcentajeTexto(listaC > 0 ? (descC / listaC) * 100 : 0),
      descuentoMonto: decimal(descC),
      precioNeto: decimal(listaC - descC),
      _netoC: listaC - descC,
    };
  });
  const sumaNetoC = detalle.reduce((a, d) => a + d._netoC, 0);
  if (Math.abs(sumaNetoC - baseC) > TOLERANCIA_SUMA_C) {
    throw invalido(`El neto por stand (${decimal(sumaNetoC)}) no coincide con la base del contrato (${decimal(baseC)}).`);
  }
  return detalle.map(({ _netoC: _omitido, ...resto }) => resto);
}

/**
 * Campos que se agregan al payload de la reserva:
 * - `TipoCambio` en toda solicitud.
 * - Con moneda PEN (regular o interna) o solicitud interna: `Comercial`, importes por cuota y
 *   `StandsDetalle` (el SIE no calcula ni convierte: valida y guarda lo que manda la web).
 * - Solo internas: ademas `Modalidad`, `Requisitos` y `Origen`.
 * Una solicitud en USD que no es interna no cambia (el SIE calcula con su lista).
 */
export function extensionReserva(ctx: ContextoExtensionReserva): Partial<ReservaIimpInput> {
  const esPen = ctx.moneda === MONEDAS.PEN;
  const plan = ctx.plan;
  const lectura = ctx.lecturaSie === true;
  /* Lectura del SIE en USD: tipo de cambio real del evento (el SIE no acepta 1). */
  const tcEvento = ctx.tipoCambioEvento;
  let tipoCambio = tipoCambioPactado(ctx.moneda, plan?.tipoCambio ?? ctx.tipoCambio);
  if (lectura && !esPen) {
    if (!(typeof tcEvento === "number" && Number.isFinite(tcEvento) && tcEvento > 0)) {
      throw invalido("El evento no tiene tipo de cambio configurado; el SIE exige el tipo de cambio real aun en dolares.");
    }
    tipoCambio = tcEvento.toFixed(4);
  }
  if (esPen && !tipoCambio) {
    throw invalido("La solicitud en soles no tiene tipo de cambio pactado; no se puede enviar al SIE.");
  }
  const extra: Partial<ReservaIimpInput> = tipoCambio ? { tipoCambio } : {};
  if (!lectura && !ctx.interna && !esPen) return extra;

  const completo =
    plan !== null &&
    plan.cuotas.length > 0 &&
    typeof plan.total === "number" &&
    typeof plan.igv === "number" &&
    typeof plan.netoLista === "number";
  if (!completo || !plan) {
    if (esPen || lectura) throw invalido("El plan de pagos de la solicitud esta incompleto; no se puede armar el detalle para el SIE.");
    return extra;
  }
  const netoLista = plan.netoLista as number;
  const totalPlan = plan.total as number;
  const igvPlan = plan.igv as number;

  const base = typeof plan.netoDescontado === "number" ? plan.netoDescontado : totalPlan - igvPlan;
  const descuentoTotal = typeof plan.descuentoMonto === "number" ? plan.descuentoMonto : netoLista - base;
  const hayDescuento = descuentoTotal > 0.004;
  const tipoDescuento = hayDescuento
    ? (TIPO_DESCUENTO_IIMP[plan.descuentoTipo ?? TIPOS_DESCUENTO.PORCENTAJE] ?? TIPO_DESCUENTO_IIMP.NINGUNO)
    : TIPO_DESCUENTO_IIMP.NINGUNO;

  const comercial: ReservaIimpComercial = {
    tipoDescuento,
    sumaLista: decimal(aCentavos(netoLista)),
    descuentoTotal: decimal(aCentavos(descuentoTotal)),
    baseImponible: decimal(aCentavos(base)),
    tasaIgv: TASA_IGV.toFixed(2),
    igv: decimal(aCentavos(igvPlan)),
    total: decimal(aCentavos(totalPlan)),
  };

  /* Cuotas: la base de cada una debe corresponder a su porcentaje (el SIE tolera 0.05). */
  const importes = importesPorCuota(plan.cuotas.map((c) => c.monto), base);
  const baseC = aCentavos(base);
  ctx.cuotas.forEach((c, i) => {
    const baseCuotaC = aCentavos(Number(importes[i]?.baseImponible ?? 0));
    const esperadaC = (baseC * c.porcentaje) / 100;
    if (Math.abs(baseCuotaC - esperadaC) > TOLERANCIA_CUOTA_C) {
      throw invalido(
        `La cuota ${i + 1} (${c.porcentaje} %) no es proporcional a su monto; el SIE exige que la base corresponda al porcentaje. Ajusta el plan de cuotas.`,
      );
    }
  });
  const cuotas = ctx.cuotas.map((c, i) => ({ ...c, ...(importes[i] ?? {}) }));

  /* StandsDetalle es obligatorio con soles o con cualquier descuento. */
  const standsDetalle =
    esPen || hayDescuento || lectura
      ? detalleStandsReserva(plan, ctx.stands, ctx.moneda, plan.tipoCambio ?? ctx.tipoCambio, aCentavos(netoLista), baseC)
      : [];

  return {
    ...extra,
    comercial,
    cuotas,
    ...(standsDetalle.length > 0 ? { standsDetalle } : {}),
    ...(lectura && plan.modalidad ? { modalidad: plan.modalidad } : {}),
    ...(ctx.interna
      ? {
          ...(plan.modalidad ? { modalidad: plan.modalidad } : {}),
          ...(ctx.requisitos ? { requisitos: ctx.requisitos } : {}),
          origen: {
            sistema: SISTEMA_ORIGEN,
            tipoSolicitud: TIPOS_SOLICITUD.RESERVA_EMPRESA.toUpperCase(),
            registradoPor: ctx.origen?.registradoPor ?? null,
            registradoEn: ctx.ahora.toISOString(),
            programadaPara: ctx.origen?.programadaPara ?? null,
          },
        }
      : {}),
  };
}
