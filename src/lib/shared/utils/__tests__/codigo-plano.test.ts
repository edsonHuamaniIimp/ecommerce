import { afterEach, describe, expect, it, vi } from "vitest";
import { PLANO_CODIGO_REGEX } from "@/lib/shared/constants";
import { codigoPlanoUtils } from "../codigo-plano";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("codigoPlanoUtils.generar", () => {
  it("genera un codigo valido con formato pab-#####", () => {
    const codigo = codigoPlanoUtils.generar();
    expect(codigo).toMatch(/^pab-\d{5}$/);
    expect(PLANO_CODIGO_REGEX.test(codigo)).toBe(true);
  });

  it("reintenta cuando el codigo ya existe", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.99999);
    expect(codigoPlanoUtils.generar(["pab-10000"])).toBe("pab-99999");
  });
});

describe("codigoPlanoUtils.esValido", () => {
  it("acepta minusculas, numeros y guiones", () => {
    expect(codigoPlanoUtils.esValido("pab-54621")).toBe(true);
    expect(codigoPlanoUtils.esValido("perumin-2026")).toBe(true);
  });

  it("rechaza mayusculas, espacios y vacios", () => {
    expect(codigoPlanoUtils.esValido("Pab-54621")).toBe(false);
    expect(codigoPlanoUtils.esValido("pab 54621")).toBe(false);
    expect(codigoPlanoUtils.esValido("")).toBe(false);
  });
});

describe("codigoPlanoUtils.existe", () => {
  it("compara sin distinguir mayusculas", () => {
    expect(codigoPlanoUtils.existe("PAB-54621", ["pab-54621"])).toBe(true);
    expect(codigoPlanoUtils.existe("pab-54622", ["pab-54621"])).toBe(false);
  });
});

describe("codigoPlanoUtils.esTipoCodigoValido", () => {
  it("acepta codigos en mayusculas con guiones", () => {
    expect(codigoPlanoUtils.esTipoCodigoValido("VIP")).toBe(true);
    expect(codigoPlanoUtils.esTipoCodigoValido("S-VIP")).toBe(true);
    expect(codigoPlanoUtils.esTipoCodigoValido("S_VIP")).toBe(true);
  });

  it("rechaza minusculas, simbolos y longitud excedida", () => {
    expect(codigoPlanoUtils.esTipoCodigoValido("vip")).toBe(false);
    expect(codigoPlanoUtils.esTipoCodigoValido("VIP!")).toBe(false);
    expect(codigoPlanoUtils.esTipoCodigoValido("A".repeat(21))).toBe(false);
  });
});

describe("codigoPlanoUtils.sugerirTipoCodigo", () => {
  it("normaliza el texto libre a codigo", () => {
    expect(codigoPlanoUtils.sugerirTipoCodigo("Stand VIP")).toBe("STAND-VIP");
    expect(codigoPlanoUtils.sugerirTipoCodigo("Estándar A")).toBe("ESTANDAR-A");
  });

  it("agrega sufijo cuando el codigo ya existe", () => {
    expect(codigoPlanoUtils.sugerirTipoCodigo("VIP", ["VIP"])).toBe("VIP-2");
    expect(codigoPlanoUtils.sugerirTipoCodigo("VIP", ["vip", "VIP-2"])).toBe("VIP-3");
  });

  it("respeta la longitud maxima al agregar sufijo", () => {
    const largo = "A".repeat(20);
    const sugerido = codigoPlanoUtils.sugerirTipoCodigo(largo, [largo]);
    expect(sugerido.length).toBeLessThanOrEqual(20);
    expect(sugerido).toBe(`${"A".repeat(18)}-2`);
  });
});
