import { describe, expect, it } from "vitest";
import { MONEDAS } from "@/lib/shared/constants";
import { sumarMontos } from "../importes";
import { planCuotasConFechas } from "../cuotas";
import {
  convertirNeto,
  etiquetaMoneda,
  formatearPrecioSolicitud,
  importesEnMoneda,
  simboloMoneda,
  tipoCambioValido,
  MONEDAS_CONTRATO,
} from "../moneda";

describe("moneda del contrato", () => {
  it("mantiene el neto en USD", () => {
    expect(convertirNeto(2000, MONEDAS_CONTRATO.USD, null)).toBe(2000);
    expect(simboloMoneda(MONEDAS_CONTRATO.USD)).toBe(MONEDAS.US_DOLAR);
    expect(etiquetaMoneda(MONEDAS_CONTRATO.USD)).toBe(MONEDAS.USD);
  });

  it("convierte a soles antes de calcular el IGV", () => {
    const resultado = importesEnMoneda(2000, MONEDAS_CONTRATO.PEN, 3.75);

    expect(resultado.neto).toBe(7500);
    expect(resultado.valorVenta).toBe(7500);
    expect(resultado.igv).toBe(1350);
    expect(resultado.total).toBe(8850);
    expect(simboloMoneda(MONEDAS_CONTRATO.PEN)).toBe(MONEDAS.SOL);
  });

  it("rechaza PEN sin tipo de cambio valido", () => {
    expect(tipoCambioValido(0)).toBe(false);
    expect(tipoCambioValido(null)).toBe(false);
    expect(() => convertirNeto(100, MONEDAS_CONTRATO.PEN, null)).toThrow();
  });

  it("formatea una solicitud con su moneda y tipo de cambio", () => {
    expect(formatearPrecioSolicitud(2000, MONEDAS_CONTRATO.PEN, 3.75, { decimales: 2 }))
      .toContain("S/");
    expect(formatearPrecioSolicitud(2000, MONEDAS_CONTRATO.PEN, 3.75, { decimales: 2 }))
      .toContain("7,500.00");
  });
});

describe("convertirNeto (sin floats sueltos)", () => {
  it.each([
    [2000, MONEDAS_CONTRATO.USD, null, 2000],
    [1.005, MONEDAS_CONTRATO.USD, null, 1.01],
    [2000, MONEDAS_CONTRATO.PEN, 3.5, 7000],
    [2000, MONEDAS_CONTRATO.PEN, 3.75, 7500],
    [12345.67, MONEDAS_CONTRATO.PEN, 3.3333, 41151.82],
    [0, MONEDAS_CONTRATO.PEN, 3.5, 0],
  ])("convierte %s %s con TC %s a %s", (usd, moneda, tc, esperado) => {
    expect(convertirNeto(usd, moneda, tc)).toBe(esperado);
  });

  it("rechaza TC fuera de rango y montos invalidos", () => {
    expect(tipoCambioValido(100)).toBe(true);
    expect(tipoCambioValido(100.0001)).toBe(false);
    expect(tipoCambioValido(-1)).toBe(false);
    expect(tipoCambioValido(Number.NaN)).toBe(false);
    expect(() => convertirNeto(100, MONEDAS_CONTRATO.PEN, 0)).toThrow();
    expect(() => convertirNeto(100, MONEDAS_CONTRATO.PEN, 100.0001)).toThrow();
    expect(() => convertirNeto(-1, MONEDAS_CONTRATO.USD, null)).toThrow(TypeError);
    expect(() => convertirNeto(Number.NaN, MONEDAS_CONTRATO.USD, null)).toThrow(TypeError);
  });
});

describe("importesEnMoneda (orden de calculo)", () => {
  it("convierte el neto y recien despues calcula el IGV", () => {
    const r = importesEnMoneda(2000, MONEDAS_CONTRATO.PEN, 3.5);
    expect(r.neto).toBe(7000);
    expect(r.valorVenta).toBe(7000);
    expect(r.igv).toBe(1260);
    expect(r.total).toBe(8260);
  });

  it("el total del plan coincide al centavo con el total del contrato", () => {
    const r = importesEnMoneda(2000, MONEDAS_CONTRATO.PEN, 3.75);
    const plan = planCuotasConFechas(r.total, [40, 30, 30], ["2026-11-15", "2027-02-15", "2027-06-15"]);

    expect(plan.reduce((sum, cuota) => sum + cuota.monto, 0)).toBeCloseTo(r.total, 2);
    expect(sumarMontos(plan)).toBe(r.total);
  });
});
