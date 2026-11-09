import { describe, expect, it } from "vitest";
import { calcularImportes, redondear2, sumarMontos } from "../importes";

describe("calcularImportes", () => {
  it("agrega IGV 18% al total (precios netos)", () => {
    const r = calcularImportes(2000);
    expect(r).toEqual({ valorVenta: 2000, igv: 360, total: 2360 });
  });

  it("aplica el IGV sin importar el comprobante (misma funcion)", () => {
    expect(calcularImportes(1000).total).toBe(1180);
  });

  it("redondea a centavos", () => {
    const r = calcularImportes(1694.915);
    expect(r.valorVenta).toBe(1694.92);
    expect(r.igv).toBe(redondear2(1694.92 * 0.18));
    expect(r.total).toBe(redondear2(r.valorVenta + r.igv));
  });

  it("mantiene consistencia en montos minimos (IGV redondea a 0.00)", () => {
    const r = calcularImportes(0.01);
    expect(r).toEqual({ valorVenta: 0.01, igv: 0, total: 0.01 });
  });
});

describe("sumarMontos", () => {
  it("suma el plan 40/30/30 con IGV (contrato MAESTRANZA / 2 stands)", () => {
    expect(sumarMontos([{ monto: 13735.2 }, { monto: 10301.4 }, { monto: 10301.4 }])).toBe(34338);
  });

  it("redondea a centavos", () => {
    expect(sumarMontos([{ monto: 0.1 }, { monto: 0.2 }])).toBe(0.3);
  });

  it("devuelve 0 con lista vacia", () => {
    expect(sumarMontos([])).toBe(0);
  });
});

describe("redondear2 (precision monetaria)", () => {
  it.each([
    [1.005, 1.01],
    [2.675, 2.68],
    [1694.915, 1694.92],
    [0.1 + 0.2, 0.3],
    [0.004, 0],
    [0.005, 0.01],
    [999999.994, 999999.99],
    [999999.995, 1000000],
  ])("redondea %s a %s", (entrada, esperado) => {
    expect(redondear2(entrada)).toBe(esperado);
  });

  it("rechaza montos no finitos", () => {
    expect(() => redondear2(Number.NaN)).toThrow(TypeError);
    expect(() => redondear2(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });
});

describe("calcularImportes (centavos exactos)", () => {
  it.each([
    [0, { valorVenta: 0, igv: 0, total: 0 }],
    [0.01, { valorVenta: 0.01, igv: 0, total: 0.01 }],
    [1.005, { valorVenta: 1.01, igv: 0.18, total: 1.19 }],
    [1694.915, { valorVenta: 1694.92, igv: 305.09, total: 2000.01 }],
  ])("calcula %s sin perder centavos", (neto, esperado) => {
    expect(calcularImportes(neto)).toEqual(esperado);
  });

  it("rechaza netos negativos o no finitos", () => {
    expect(() => calcularImportes(-1)).toThrow(TypeError);
    expect(() => calcularImportes(Number.NaN)).toThrow(TypeError);
    expect(() => calcularImportes(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });
});

describe("sumarMontos (suma exacta en centavos)", () => {
  it.each([
    [[0.1, 0.2], 0.3],
    [[1.005, 2.675], 3.69],
    [[13735.2, 10301.4, 10301.4], 34338],
    [[0.01, 0.01, 0.01], 0.03],
  ])("suma %j", (montos, esperado) => {
    expect(sumarMontos(montos.map((monto) => ({ monto })))).toBe(esperado);
  });
});
