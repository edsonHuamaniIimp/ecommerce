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
