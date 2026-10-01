import { describe, expect, it } from "vitest";
import { numberUtils } from "../number";

describe("numberUtils.monto", () => {
  it("mantiene el formato historico sin idioma (en-US, sin decimales)", () => {
    expect(numberUtils.monto(135000, "US$")).toBe("US$ 135,000");
  });

  it("soporta decimales", () => {
    expect(numberUtils.monto(12000, "US$", { decimales: 2 })).toBe("US$ 12,000.00");
  });

  it("formatea segun el idioma", () => {
    expect(numberUtils.monto(12000, "US$", { idioma: "en", decimales: 2 })).toBe("US$ 12,000.00");
    expect(numberUtils.monto(12000, "US$", { idioma: "es", decimales: 2 })).toMatch(/US\$ 12[,.]000[.,]00/);
  });

  it("idioma invalido cae a espanol (es-PE)", () => {
    expect(numberUtils.monto(12000, "US$", { idioma: "pt", decimales: 2 })).toMatch(/12[,.]000/);
  });
});

describe("numberUtils.porcentaje", () => {
  it("calcula el porcentaje con un decimal", () => {
    expect(numberUtils.porcentaje(1500, 12000)).toBe(12.5);
  });

  it("devuelve 0 si el total es 0", () => {
    expect(numberUtils.porcentaje(100, 0)).toBe(0);
  });
});
