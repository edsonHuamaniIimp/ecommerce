import { describe, it, expect } from "vitest";
import { extensionReserva, importesPorCuota, tipoCambioPactado } from "../extension-reserva-iimp";
import type { PlanCuotasSolicitud } from "@/domain/models/entities";

const AHORA = new Date("2026-11-24T17:26:18Z");

/** Caso A real de QA: PEN, tipo de cambio 3.50, 20/20/60. */
const planPen: PlanCuotasSolicitud = {
  modalidad: "personalizado",
  moneda: "PEN",
  tipoCambio: 3.5,
  netoLista: 84420,
  descuentoMonto: 0,
  netoDescontado: 84420,
  igv: 15195.6,
  total: 99615.6,
  cuotas: [
    { numero: 1, porcentaje: 20, monto: 19923.12, fechaVencimiento: "2026-11-20" },
    { numero: 2, porcentaje: 20, monto: 19923.12, fechaVencimiento: "2026-12-05" },
    { numero: 3, porcentaje: 60, monto: 59769.36, fechaVencimiento: "2026-12-09" },
  ],
};

/** Caso B real de QA: USD con descuento por stand, 40/20/40. */
const planUsd: PlanCuotasSolicitud = {
  modalidad: "personalizado",
  moneda: "USD",
  tipoCambio: 1,
  descuentoTipo: "por_stand",
  netoLista: 36960,
  descuentoMonto: 1293.6,
  netoDescontado: 35666.4,
  igv: 6419.95,
  total: 42086.35,
  descuentosPorStand: [
    { standId: "a", standCode: "83", precio: 9240, porcentaje: 3, descuentoMonto: 277.2, neto: 8962.8 },
    { standId: "d", standCode: "86", precio: 9240, porcentaje: 5, descuentoMonto: 462, neto: 8778 },
  ],
  cuotas: [
    { numero: 1, porcentaje: 40, monto: 16834.54, fechaVencimiento: "2026-12-22" },
    { numero: 2, porcentaje: 20, monto: 8417.27, fechaVencimiento: "2026-12-30" },
    { numero: 3, porcentaje: 40, monto: 16834.54, fechaVencimiento: "2027-04-02" },
  ],
};

const cuotasWeb = (plan: PlanCuotasSolicitud) => plan.cuotas.map((c) => ({ porcentaje: c.porcentaje ?? 0, fecha: c.fechaVencimiento ?? "" }));

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
    const sumaBase = r.reduce((s, c) => s + Math.round(Number(c.baseImponible) * 100), 0);
    expect(sumaBase).toBe(3566640);
    for (const c of r) expect(Math.round(Number(c.baseImponible) * 100) + Math.round(Number(c.igv) * 100)).toBe(Math.round(Number(c.monto) * 100));
  });
});

describe("extensionReserva", () => {
  it("solicitud regular: solo TipoCambio", () => {
    const r = extensionReserva({ moneda: "PEN", tipoCambio: 3.5, plan: planPen, cuotas: cuotasWeb(planPen), interna: false, requisitos: null, origen: null, ahora: AHORA });
    expect(r).toEqual({ tipoCambio: "3.5000" });
  });

  it("interna en PEN: tipo de cambio, comercial e importes por cuota", () => {
    const r = extensionReserva({ moneda: "PEN", tipoCambio: 3.5, plan: planPen, cuotas: cuotasWeb(planPen), interna: true, requisitos: null, origen: { tipoSolicitud: "RESERVA_EMPRESA", registradoPor: "admin@iimp.org.pe", programadaPara: null }, ahora: AHORA });
    expect(r.tipoCambio).toBe("3.5000");
    expect(r.comercial).toEqual({ tipoDescuento: "NINGUNO", sumaLista: "84420.00", descuentoTotal: "0.00", baseImponible: "84420.00", tasaIgv: "18.00", igv: "15195.60", total: "99615.60" });
    expect(r.cuotas?.map((c) => [c.baseImponible, c.igv, c.monto])).toEqual([
      ["16884.00", "3039.12", "19923.12"],
      ["16884.00", "3039.12", "19923.12"],
      ["50652.00", "9117.36", "59769.36"],
    ]);
    expect(r.standsDetalle).toBeUndefined();
    expect(r.origen).toEqual({ sistema: "CONTRATOS_STANDS", tipoSolicitud: "RESERVA_EMPRESA", registradoPor: "admin@iimp.org.pe", registradoEn: "2026-11-24T17:26:18.000Z", programadaPara: null });
  });

  it("interna en USD con descuento por stand: detalle por stand y origen programado", () => {
    const r = extensionReserva({
      moneda: "USD", tipoCambio: 1, plan: planUsd, cuotas: cuotasWeb(planUsd), interna: true,
      requisitos: { oc: true, hes: true, plataforma: false, plataformaNombre: null, plataformaUrl: null, valorizacion: false, otros: null, ninguna: false, cuotaOrigen: 1 },
      origen: { tipoSolicitud: "RESERVA_EMPRESA", registradoPor: "admin@iimp.org.pe", programadaPara: "2026-11-24T17:26:00.000Z" }, ahora: AHORA,
    });
    expect(r.tipoCambio).toBe("1.0000");
    expect(r.comercial).toMatchObject({ tipoDescuento: "POR_STAND", descuentoTotal: "1293.60", baseImponible: "35666.40", igv: "6419.95", total: "42086.35" });
    expect(r.standsDetalle?.[0]).toEqual({ numero: "83", precioLista: "9240.00", descuentoPorcentaje: "3.00", descuentoMonto: "277.20", precioNeto: "8962.80" });
    expect(r.requisitos?.oc).toBe(true);
    expect(r.origen?.programadaPara).toBe("2026-11-24T17:26:00.000Z");
  });

  it("interna sin plan completo: no inventa importes", () => {
    const r = extensionReserva({ moneda: "USD", tipoCambio: 1, plan: { modalidad: "cuotas", cuotas: [] }, cuotas: [], interna: true, requisitos: null, origen: null, ahora: AHORA });
    expect(r).toEqual({ tipoCambio: "1.0000" });
  });
});
