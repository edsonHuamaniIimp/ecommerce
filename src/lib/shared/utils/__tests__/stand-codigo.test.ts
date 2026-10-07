import { describe, expect, it } from "vitest";
import { codigoComercialStand } from "../stand-codigo";

describe("codigoComercialStand", () => {
  it("quita el prefijo tecnico BLOQUE- cuando el dato viene del plano", () => {
    expect(codigoComercialStand("BLOQUE-774")).toBe("774");
    expect(codigoComercialStand("bloque-06")).toBe("06");
  });

  it("deja intacto un codigo comercial y tolera vacios", () => {
    expect(codigoComercialStand("774")).toBe("774");
    expect(codigoComercialStand("VIP4334")).toBe("VIP4334");
    expect(codigoComercialStand(null)).toBe("");
    expect(codigoComercialStand("  ")).toBe("");
  });
});
