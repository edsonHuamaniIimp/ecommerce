import { describe, expect, it } from "vitest";
import { generarContratoSchema } from "../contratos.validator";

const SOLICITUD_ID = "11111111-1111-4111-8111-111111111111";

function cuota(porcentaje: number, fechaVencimiento = "2099-01-01") {
  return { porcentaje, fechaVencimiento };
}

function parse(partial: Record<string, unknown>) {
  return generarContratoSchema.safeParse({ solicitudId: SOLICITUD_ID, ...partial });
}

describe("generarContratoSchema — cuotas configurables (RF-10)", () => {
  it("acepta una cuota al 100% con su fecha", () => {
    expect(parse({ cuotas: [cuota(100)] }).success).toBe(true);
  });

  it("acepta 50% + 50% en fechas ascendentes", () => {
    expect(parse({ cuotas: [cuota(50, "2099-01-01"), cuota(50, "2099-02-01")] }).success).toBe(true);
  });

  it("acepta un plan personalizado de 3 cuotas que suman 100", () => {
    expect(parse({ cuotas: [cuota(30, "2099-01-01"), cuota(30, "2099-02-01"), cuota(40, "2099-03-01")] }).success).toBe(true);
  });

  it("acepta la suma exacta aun con ruido de punto flotante", () => {
    expect(parse({ cuotas: [cuota(33.33, "2099-01-01"), cuota(33.33, "2099-02-01"), cuota(33.34, "2099-03-01")] }).success).toBe(true);
  });

  it("rechaza una lista vacia", () => {
    expect(parse({ cuotas: [] }).success).toBe(false);
  });

  it("rechaza mas de 3 cuotas", () => {
    expect(parse({ cuotas: [cuota(25), cuota(25), cuota(25), cuota(25)] }).success).toBe(false);
  });

  it("rechaza porcentajes en cero o negativos", () => {
    expect(parse({ cuotas: [cuota(0), cuota(100)] }).success).toBe(false);
    expect(parse({ cuotas: [cuota(-10), cuota(110)] }).success).toBe(false);
  });

  it("rechaza porcentajes mayores a 100", () => {
    expect(parse({ cuotas: [cuota(101)] }).success).toBe(false);
  });

  it("rechaza sumas distintas de 100 y desviaciones de un centavo", () => {
    expect(parse({ cuotas: [cuota(50), cuota(49)] }).success).toBe(false);
    expect(parse({ cuotas: [cuota(50.01), cuota(25), cuota(24.98)] }).success).toBe(false);
  });

  it("rechaza porcentajes con mas de 2 decimales", () => {
    expect(parse({ cuotas: [cuota(33.333), cuota(33.333), cuota(33.334)] }).success).toBe(false);
  });

  it("rechaza valores no numericos", () => {
    expect(parse({ cuotas: [{ porcentaje: "50", fechaVencimiento: "2099-01-01" }] }).success).toBe(false);
    expect(parse({ cuotas: [cuota(Number.NaN)] }).success).toBe(false);
  });

  it("rechaza fechas pasadas", () => {
    expect(parse({ cuotas: [cuota(100, "2020-01-01")] }).success).toBe(false);
  });

  it("rechaza fechas con formato invalido", () => {
    expect(parse({ cuotas: [cuota(100, "01/02/2099")] }).success).toBe(false);
    expect(parse({ cuotas: [cuota(100, "2099-1-1")] }).success).toBe(false);
  });

  it("rechaza fechas fuera de orden cronologico", () => {
    expect(parse({ cuotas: [cuota(50, "2099-02-01"), cuota(50, "2099-01-01")] }).success).toBe(false);
  });

  it("rechaza un solicitudId que no es uuid", () => {
    expect(generarContratoSchema.safeParse({ solicitudId: "abc", cuotas: [cuota(100)] }).success).toBe(false);
  });

  it("acepta idioma es|en y rechaza otros", () => {
    expect(parse({ cuotas: [cuota(100)], idioma: "en" }).success).toBe(true);
    expect(parse({ cuotas: [cuota(100)], idioma: "es" }).success).toBe(true);
    expect(parse({ cuotas: [cuota(100)], idioma: "pt" }).success).toBe(false);
    expect(parse({ cuotas: [cuota(100)] }).success).toBe(true);
  });
});
