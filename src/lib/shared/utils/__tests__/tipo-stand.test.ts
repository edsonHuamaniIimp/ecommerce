import { describe, expect, it } from "vitest";
import { claveTipoStand, labelTipoStand, normalizarTipoStand } from "../tipo-stand";

describe("normalizarTipoStand", () => {
  it("repara los caracteres CP437 que llegan del API externo", () => {
    expect(normalizarTipoStand("EST\u2534NDAR 6MT2")).toBe("ESTÁNDAR 6MT2");
    expect(normalizarTipoStand("EXHIBICIËN DE MAQUINARIA 100 MT2")).toBe("EXHIBICIÓN DE MAQUINARIA 100 MT2");
  });

  it("devuelve null para valores vacios", () => {
    expect(normalizarTipoStand(null)).toBeNull();
    expect(normalizarTipoStand("   ")).toBeNull();
  });
});

describe("claveTipoStand", () => {
  it("normaliza mayusculas y espacios", () => {
    expect(claveTipoStand("estandar_01")).toBe("ESTANDAR_01");
    expect(claveTipoStand("E STANDAR_02")).toBe("ESTANDAR_02");
  });

  it("resuelve alias del catalogo", () => {
    expect(claveTipoStand("ISLA")).toBe("ISLAS");
    expect(claveTipoStand("estandar")).toBe("ESTANDAR_01");
    expect(claveTipoStand("Prereferencial")).toBe("PREFERENCIAL");
  });

  it("mantiene tipos desconocidos normalizados", () => {
    expect(claveTipoStand("Premium")).toBe("PREMIUM");
  });

  it("devuelve null si viene vacio", () => {
    expect(claveTipoStand(null)).toBeNull();
    expect(claveTipoStand("   ")).toBeNull();
  });
});

describe("labelTipoStand", () => {
  it("devuelve la etiqueta del catalogo", () => {
    expect(labelTipoStand("ISLA")).toBe("Isla");
    expect(labelTipoStand("PREFERENCIAL")).toBe("Preferencial");
  });

  it("devuelve la clave si no esta en el catalogo", () => {
    expect(labelTipoStand("PREMIUM")).toBe("PREMIUM");
  });
});
