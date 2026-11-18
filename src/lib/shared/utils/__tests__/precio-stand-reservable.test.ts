import { describe, expect, it } from "vitest";
import { esStandComercialReservable } from "../precio-stand";

describe("esStandComercialReservable", () => {
  it("acepta un stand activo, vinculado a 3D y con precio explícito", () => {
    expect(esStandComercialReservable({
      flgActivo: true,
      bloqueId: "B-1",
      medidas: "7440.00 USD",
      tipoStand: "ESTANDAR_01",
    })).toBe(true);
  });

  it("rechaza stands sin bloque 3D, sin precio o con precio 0.00", () => {
    expect(esStandComercialReservable({
      bloqueId: null,
      medidas: "7440.00 USD",
      tipoStand: "ESTANDAR_01",
    })).toBe(false);
    expect(esStandComercialReservable({
      bloqueId: "B-1",
      medidas: "3x3",
      tipoStand: "ESTANDAR_01",
    })).toBe(false);
    expect(esStandComercialReservable({
      bloqueId: "B-1",
      medidas: "0.00 USD",
      tipoStand: "ESTANDAR_01",
    })).toBe(false);
    expect(esStandComercialReservable({
      flgActivo: false,
      bloqueId: "B-1",
      medidas: "7440.00 USD",
    })).toBe(false);
  });
});
