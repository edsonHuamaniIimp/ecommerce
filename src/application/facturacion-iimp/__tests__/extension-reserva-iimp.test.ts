import { describe, it, expect } from "vitest";
import { extensionReserva, importesPorCuota, tipoCambioPactado, type ContextoExtensionReserva, type StandPrecioReserva } from "../extension-reserva-iimp";
import type { PlanCuotasSolicitud } from "@/domain/models/entities";

const AHORA = new Date("2026-11-24T17:26:18Z");

/** Caso A real de QA: PEN, tipo de cambio 3.50, stands 114/117/118 (USD 7,440 / 7,440 / 9,240), 20/20/60. */
const planPen: PlanCuotasSolicitud = {
  modalidad: "personalizado", moneda: "PEN", tipoCambio: 3.5,
  netoLista: 84420, descuentoMonto: 0, netoDescontado: 84420, igv: 15195.6, total: 99615.6,
  cuotas: [
    { numero: 1, porcentaje: 20, monto: 19923.12, fechaVencimiento: "2026-11-20" },
    { numero: 2, porcentaje: 20, monto: 19923.12, fechaVencimiento: "2026-12-05" },
    { numero: 3, porcentaje: 60, monto: 59769.36, fechaVencimiento: "2026-12-09" },
  ],
};
const standsPen: StandPrecioReserva[] = [
  { codigo: "114", standCode: "114", precioUsd: 7440 },
  { codigo: "117", standCode: "117", precioUsd: 7440 },
  { codigo: "118", standCode: "118", precioUsd: 9240 },
];

/** Caso B real de QA: USD, descuento por stand (3 % x3 y 5 %), 40/20/40. */
const planUsd: PlanCuotasSolicitud = {
  modalidad: "personalizado", moneda: "USD", tipoCambio: 1, descuentoTipo: "por_stand",
  netoLista: 36960, descuentoMonto: 1293.6, netoDescontado: 35666.4, igv: 6419.95, total: 42086.35,
  descuentosPorStand: [
    { standId: "a", standCode: "83", precio: 9240, porcentaje: 3, descuentoMonto: 277.2, neto: 8962.8 },
    { standId: "b", standCode: "84", precio: 9240, porcentaje: 3, descuentoMonto: 277.2, neto: 8962.8 },
    { standId: "c", standCode: "85", precio: 9240, porcentaje: 3, descuentoMonto: 277.2, neto: 8962.8 },
    { standId: "d", standCode: "86", precio: 9240, porcentaje: 5, descuentoMonto: 462, neto: 8778 },
  ],
  cuotas: [
    { numero: 1, porcentaje: 40, monto: 16834.54, fechaVencimiento: "2026-12-22" },
    { numero: 2, porcentaje: 20, monto: 8417.27, fechaVencimiento: "2026-12-30" },
    { numero: 3, porcentaje: 40, monto: 16834.54, fechaVencimiento: "2027-04-02" },
  ],
};
const standsUsd: StandPrecioReserva[] = ["83", "84", "85", "86"].map((c) => ({ codigo: c, standCode: c, precioUsd: 9240 }));

const cuotasWeb = (plan: PlanCuotasSolicitud) => plan.cuotas.map((c) => ({ porcentaje: c.porcentaje ?? 0, fecha: c.fechaVencimiento ?? "" }));
const ctx = (over: Partial<ContextoExtensionReserva> & Pick<ContextoExtensionReserva, "plan" | "stands" | "moneda">): ContextoExtensionReserva => ({
  tipoCambio: over.plan?.tipoCambio ?? null, cuotas: over.plan ? cuotasWeb(over.plan) : [], interna: false, requisitos: null, origen: null, ahora: AHORA, ...over,
});

describe("tipoCambioPactado", () => {
  it("USD siempre 1.0000", () => expect(tipoCambioPactado("USD", 3.5)).toBe("1.0000"));
  it("PEN usa el tipo de cambio del contrato", () => expect(tipoCambioPactado("PEN", 3.5)).toBe("3.5000"));
  it("PEN sin tipo de cambio no inventa uno", () => expect(tipoCambioPactado("PEN", null)).toBeNull());
});

describe("importesPorCuota", () => {
  it("la suma de bases es exactamente la base del contrato y base + igv = monto", () => {
    const r = importesPorCuota([16834.54, 8417.27, 16834.54], 35666.4);
    expect(r.map((c) => c.baseImponible)).toEqual(["14266.56", "7133.28", "14266.56"]);
    expect(r.map((c) => c.igv)).toEqual(["2567.98", "1283.99", "2567.98"]);
    expect(r.reduce((s, c) => s + Math.round(Number(c.baseImponible) * 100), 0)).toBe(3566640);
  });
});

describe("extensionReserva", () => {
  it("regular en USD: solo TipoCambio (el SIE calcula con su lista)", () => {
    expect(extensionReserva(ctx({ moneda: "USD", plan: planUsd, stands: standsUsd }))).toEqual({ tipoCambio: "1.0000" });
  });

  it("regular en PEN: el SIE exige importes -> Comercial, cuotas y StandsDetalle completos, sin Origen", () => {
    const r = extensionReserva(ctx({ moneda: "PEN", plan: planPen, stands: standsPen }));
    expect(r.tipoCambio).toBe("3.5000");
    expect(r.comercial).toMatchObject({ tipoDescuento: "NINGUNO", sumaLista: "84420.00", baseImponible: "84420.00", igv: "15195.60", total: "99615.60" });
    expect(r.standsDetalle).toEqual([
      { numero: "114", precioLista: "26040.00", descuentoPorcentaje: "0.00", descuentoMonto: "0.00", precioNeto: "26040.00" },
      { numero: "117", precioLista: "26040.00", descuentoPorcentaje: "0.00", descuentoMonto: "0.00", precioNeto: "26040.00" },
      { numero: "118", precioLista: "32340.00", descuentoPorcentaje: "0.00", descuentoMonto: "0.00", precioNeto: "32340.00" },
    ]);
    expect(r.cuotas?.map((c) => [c.baseImponible, c.igv, c.monto])).toEqual([
      ["16884.00", "3039.12", "19923.12"], ["16884.00", "3039.12", "19923.12"], ["50652.00", "9117.36", "59769.36"],
    ]);
    expect(r.origen).toBeUndefined();
    expect(r.requisitos).toBeUndefined();
  });

  it("interna en USD con descuento por stand: detalle de los 4 stands, requisitos y origen programado", () => {
    const r = extensionReserva(ctx({
      moneda: "USD", plan: planUsd, stands: standsUsd, interna: true,
      requisitos: { oc: true, hes: true, plataforma: false, plataformaNombre: null, plataformaUrl: null, valorizacion: false, otros: null, ninguna: false, cuotaOrigen: 1 },
      origen: { tipoSolicitud: "RESERVA_EMPRESA", registradoPor: "admin@iimp.org.pe", programadaPara: "2026-11-24T17:26:00.000Z" },
    }));
    expect(r.comercial).toMatchObject({ tipoDescuento: "POR_STAND", descuentoTotal: "1293.60", baseImponible: "35666.40", igv: "6419.95", total: "42086.35" });
    expect(r.standsDetalle).toHaveLength(4);
    expect(r.standsDetalle?.[0]).toEqual({ numero: "83", precioLista: "9240.00", descuentoPorcentaje: "3.00", descuentoMonto: "277.20", precioNeto: "8962.80" });
    expect(r.standsDetalle?.[3]).toMatchObject({ descuentoPorcentaje: "5.00", precioNeto: "8778.00" });
    expect(r.requisitos?.oc).toBe(true);
    expect(r.origen).toMatchObject({ sistema: "CONTRATOS_STANDS", tipoSolicitud: "RESERVA_EMPRESA", programadaPara: "2026-11-24T17:26:00.000Z" });
  });

  it("interna en USD sin descuento: sin StandsDetalle (el SIE lo permite omitir)", () => {
    const plan: PlanCuotasSolicitud = { ...planPen, moneda: "USD", tipoCambio: 1 };
    const r = extensionReserva(ctx({ moneda: "USD", plan, stands: standsPen, interna: true }));
    expect(r.standsDetalle).toBeUndefined();
    expect(r.comercial?.tipoDescuento).toBe("NINGUNO");
  });

  it("descuento global en porcentaje: reparte por stand y suma la base exacta", () => {
    // 3 stands USD 9,240 = 27,720; 10 % global -> base 24,948; IGV 4,490.64; total 29,438.64
    const plan: PlanCuotasSolicitud = {
      modalidad: "completo", moneda: "USD", tipoCambio: 1, descuentoTipo: "porcentaje", descuentoValor: 10, descuentoPorcentaje: 10,
      netoLista: 27720, descuentoMonto: 2772, netoDescontado: 24948, igv: 4490.64, total: 29438.64,
      cuotas: [{ numero: 1, porcentaje: 100, monto: 29438.64, fechaVencimiento: "2026-12-01" }],
    };
    const stands = ["A1", "A2", "A3"].map((c) => ({ codigo: c, standCode: c, precioUsd: 9240 }));
    const r = extensionReserva(ctx({ moneda: "USD", plan, stands, interna: true }));
    expect(r.comercial?.tipoDescuento).toBe("PORCENTAJE");
    expect(r.standsDetalle?.map((s) => s.precioNeto)).toEqual(["8316.00", "8316.00", "8316.00"]);
    expect(r.standsDetalle?.every((s) => s.descuentoPorcentaje === "10.00")).toBe(true);
  });

  it("usa el codigo con que el stand viaja en Stands (standApiId) y no el comercial", () => {
    const stands = standsUsd.map((s) => ({ ...s, codigo: `API-${s.standCode}` }));
    const r = extensionReserva(ctx({ moneda: "USD", plan: planUsd, stands, interna: true }));
    expect(r.standsDetalle?.map((s) => s.numero)).toEqual(["API-83", "API-84", "API-85", "API-86"]);
  });

  it("PEN sin tipo de cambio: falla antes de enviar", () => {
    const plan = { ...planPen, tipoCambio: null };
    expect(() => extensionReserva(ctx({ moneda: "PEN", plan, stands: standsPen, tipoCambio: null }))).toThrow(/tipo de cambio/i);
  });

  it("PEN con plan incompleto: falla antes de enviar", () => {
    expect(() => extensionReserva(ctx({ moneda: "PEN", plan: { modalidad: "cuotas", moneda: "PEN", tipoCambio: 3.5, cuotas: [] }, stands: standsPen }))).toThrow(/incompleto/i);
  });

  it("lista de precios desactualizada: avisa en vez de enviar", () => {
    const stands = standsPen.map((s) => ({ ...s, precioUsd: s.precioUsd + 100 }));
    expect(() => extensionReserva(ctx({ moneda: "PEN", plan: planPen, stands }))).toThrow(/lista de precios/i);
  });

  it("cuota no proporcional a su porcentaje: avisa en vez de enviar", () => {
    const cuotas = [{ porcentaje: 33, fecha: "2026-11-20" }, { porcentaje: 33, fecha: "2026-12-05" }, { porcentaje: 34, fecha: "2026-12-09" }];
    expect(() => extensionReserva(ctx({ moneda: "PEN", plan: planPen, stands: standsPen, cuotas }))).toThrow(/proporcional/i);
  });

  it("interna sin plan completo en USD: no inventa importes", () => {
    expect(extensionReserva(ctx({ moneda: "USD", plan: { modalidad: "cuotas", cuotas: [] }, stands: [], interna: true }))).toEqual({ tipoCambio: "1.0000" });
  });
});
