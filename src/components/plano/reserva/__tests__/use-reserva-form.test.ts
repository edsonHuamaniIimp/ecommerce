import { describe, expect, it } from "vitest";
import { cuotasConfigValidas, firmaReservaLista } from "../use-reserva-form";

const HOY = "2026-10-19";
const CONFIG_4 = {
  maxCuotas: 4,
  fechas: ["2026-11-20", "2026-11-27", "2026-12-18", "2027-04-30"],
};

const CUATRO_CUOTAS = CONFIG_4.fechas.map((fecha) => ({ porcentaje: 25, fecha }));

describe("cuotasConfigValidas (paso Cuotas del wizard)", () => {
  it("acepta el cronograma personalizado de 4 cuotas de la empresa", () => {
    expect(cuotasConfigValidas(CUATRO_CUOTAS, CONFIG_4, HOY)).toBe(true);
  });

  it("rechaza una cantidad o fechas distintas a la configuracion de la empresa", () => {
    expect(cuotasConfigValidas(CUATRO_CUOTAS.slice(0, 3), CONFIG_4, HOY)).toBe(false);
    expect(cuotasConfigValidas(
      [{ porcentaje: 25, fecha: "2026-11-21" }, ...CUATRO_CUOTAS.slice(1)],
      CONFIG_4,
      HOY,
    )).toBe(false);
  });

  it("rechaza porcentajes que no suman 100 en el cronograma personalizado", () => {
    expect(cuotasConfigValidas(
      CUATRO_CUOTAS.map((cuota) => ({ ...cuota, porcentaje: 20 })),
      CONFIG_4,
      HOY,
    )).toBe(false);
  });

  it("mantiene las modalidades estandar cuando la empresa no tiene configuracion", () => {
    expect(cuotasConfigValidas(
      [
        { porcentaje: 40, fecha: "2026-11-15" },
        { porcentaje: 30, fecha: "2027-02-15" },
        { porcentaje: 30, fecha: "2027-06-15" },
      ],
      null,
      HOY,
    )).toBe(true);
    expect(cuotasConfigValidas(CUATRO_CUOTAS, null, HOY)).toBe(false);
  });
});

describe("firmaReservaLista (paso Contrato)", () => {
  it("acepta firma manual ya subida o firma digital pendiente de aplicar", () => {
    expect(firmaReservaLista("/uploads/firmado.pdf", false)).toBe(true);
    expect(firmaReservaLista(null, true)).toBe(true);
  });

  it("rechaza el paso cuando no hay ninguna firma", () => {
    expect(firmaReservaLista(null, false)).toBe(false);
  });
});
