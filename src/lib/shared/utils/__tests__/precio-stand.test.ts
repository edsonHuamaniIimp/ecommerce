import { describe, expect, it } from "vitest";
import { PRECIO_STAND_DEFAULT } from "@/lib/shared/constants";
import {
  precioNumericoDesdeTipo,
  precioTexto,
  precioTextoDesdeTipo,
  resolverPrecioStand,
} from "../precio-stand";

describe("precioNumericoDesdeTipo", () => {
  it("resuelve los tipos del catalogo (incluye ISLAS)", () => {
    expect(precioNumericoDesdeTipo("PREFERENCIAL")).toBe(3000);
    expect(precioNumericoDesdeTipo("ESTANDAR_01")).toBe(2000);
    expect(precioNumericoDesdeTipo("ESTANDAR_02")).toBe(2500);
    expect(precioNumericoDesdeTipo("ISLAS")).toBe(12000);
    expect(precioNumericoDesdeTipo("ISLA")).toBe(12000);
  });

  it("normaliza el tipo del API externo (espacios/mayusculas)", () => {
    expect(precioNumericoDesdeTipo("E STANDAR_01")).toBe(2000);
    expect(precioNumericoDesdeTipo("islas")).toBe(12000);
    expect(precioNumericoDesdeTipo("PREREFERENCIAL_01")).toBe(3000);
  });

  it("usa el default cuando el tipo es desconocido y null cuando no hay tipo", () => {
    expect(precioNumericoDesdeTipo("VIP")).toBe(PRECIO_STAND_DEFAULT);
    expect(precioNumericoDesdeTipo(null)).toBeNull();
    expect(precioNumericoDesdeTipo("")).toBeNull();
  });
});

describe("precioTextoDesdeTipo", () => {
  it("mantiene el formato historico de `medidas`", () => {
    expect(precioTextoDesdeTipo("ISLAS")).toBe("12000.00 US$");
    expect(precioTextoDesdeTipo("ESTANDAR_01")).toBe("2000.00 US$");
    expect(precioTextoDesdeTipo(null)).toBe("2000.00 US$");
  });
});

describe("precioTexto", () => {
  it("formatea montos con separador de miles", () => {
    expect(precioTexto(12000)).toBe("US$ 12,000.00");
    expect(precioTexto(2000)).toBe("US$ 2,000.00");
  });
});

describe("resolverPrecioStand", () => {
  it("prioriza `medidas` cuando es un texto de precio", () => {
    expect(resolverPrecioStand({ medidas: "2000.00 US$", tipoStand: "ISLAS" })).toBe(2000);
    expect(resolverPrecioStand({ medidas: "1200", tipoStand: "ISLAS" })).toBe(1200);
  });

  it("ignora `medidas` cuando es una medida real y resuelve por tipo", () => {
    expect(resolverPrecioStand({ medidas: "3x3", tipoStand: "ESTANDAR_01" })).toBe(2000);
    expect(resolverPrecioStand({ medidas: "ISLA", tipoStand: "ISLAS" })).toBe(12000);
  });

  it("usa rawData cuando `medidas` no es precio", () => {
    expect(resolverPrecioStand({ medidas: "ISLA", tipoStand: "ISLAS", rawData: { precio: 9500 } })).toBe(9500);
    expect(resolverPrecioStand({ medidas: null, tipoStand: "ISLAS", rawData: { monto: "8,000.00" } })).toBe(8000);
  });

  it("cae al catalogo/default sin datos", () => {
    expect(resolverPrecioStand({ medidas: null, tipoStand: "PREFERENCIAL" })).toBe(3000);
    expect(resolverPrecioStand({ medidas: null, tipoStand: null })).toBe(PRECIO_STAND_DEFAULT);
  });
});
