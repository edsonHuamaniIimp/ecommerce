import { describe, expect, it } from "vitest";
import { PISO_FURNITURE_DEFAULT, PERSONA_FURNITURE_DEFAULT, TIPOS_FURNITURE } from "@/lib/shared/constants";
import { furnitureUtils } from "../furniture";

describe("furnitureUtils.refIdSugerido", () => {
  it("genera refId con prefijo del tipo y correlativo", () => {
    expect(furnitureUtils.refIdSugerido(TIPOS_FURNITURE.KIOSKO)).toBe("KIOSKO-01");
    expect(furnitureUtils.refIdSugerido(TIPOS_FURNITURE.PLAZA)).toBe("PLAZA-01");
    expect(furnitureUtils.refIdSugerido(TIPOS_FURNITURE.PERSONA)).toBe("PERSONA-01");
  });

  it("evita colisiones con los refId existentes", () => {
    expect(furnitureUtils.refIdSugerido("kiosko", ["KIOSKO-01", "KIOSKO-02"])).toBe("KIOSKO-03");
    expect(furnitureUtils.refIdSugerido("kiosko", ["kiosko-01"])).toBe("KIOSKO-02");
  });
});

describe("furnitureUtils.configPorDefecto", () => {
  it("Persona y Piso arrancan con config", () => {
    expect(furnitureUtils.configPorDefecto(TIPOS_FURNITURE.PERSONA)).toEqual(PERSONA_FURNITURE_DEFAULT);
    expect(furnitureUtils.configPorDefecto(TIPOS_FURNITURE.PISO)).toEqual(PISO_FURNITURE_DEFAULT);
    expect(furnitureUtils.configPorDefecto(TIPOS_FURNITURE.KIOSKO)).toBeUndefined();
    expect(furnitureUtils.configPorDefecto(TIPOS_FURNITURE.MESA)).toBeUndefined();
    expect(furnitureUtils.configPorDefecto(TIPOS_FURNITURE.SILLON)).toBeUndefined();
  });
});

describe("furnitureUtils.pisoConfig", () => {
  it("usa el default ante config invalido", () => {
    expect(furnitureUtils.pisoConfig(null)).toEqual(PISO_FURNITURE_DEFAULT);
    expect(furnitureUtils.pisoConfig({ w: 0, d: -2 })).toEqual(PISO_FURNITURE_DEFAULT);
  });

  it("respeta dimensiones validas", () => {
    expect(furnitureUtils.pisoConfig({ w: 5, d: 3.5 })).toEqual({ w: 5, d: 3.5 });
  });
});

describe("furnitureUtils.huella", () => {
  it("devuelve la huella fija de los componentes", () => {
    expect(furnitureUtils.huella(TIPOS_FURNITURE.MESA)).toEqual({ w: 0.8, d: 0.8 });
    expect(furnitureUtils.huella(TIPOS_FURNITURE.KIOSKO)).toEqual({ w: 1.8, d: 1.2 });
  });

  it("resuelve la huella del Piso desde su config", () => {
    expect(furnitureUtils.huella(TIPOS_FURNITURE.PISO, { w: 4, d: 2 })).toEqual({ w: 4, d: 2 });
    expect(furnitureUtils.huella(TIPOS_FURNITURE.PISO)).toEqual(PISO_FURNITURE_DEFAULT);
  });

  it("cae a un default para tipos desconocidos", () => {
    expect(furnitureUtils.huella("desconocido")).toEqual({ w: 2, d: 2 });
  });
});

describe("furnitureUtils.personaConfig", () => {
  it("usa defaults cuando el config es invalido o legacy", () => {
    expect(furnitureUtils.personaConfig(null)).toEqual(PERSONA_FURNITURE_DEFAULT);
    expect(furnitureUtils.personaConfig({ colorIdx: -1, torsoColor: "" })).toEqual(PERSONA_FURNITURE_DEFAULT);
  });

  it("respeta el config valido y normaliza colorIdx", () => {
    const config = furnitureUtils.personaConfig({ colorIdx: 3, torsoColor: "#111111", piernasColor: "#222222" });
    expect(config).toEqual({ colorIdx: 3, torsoColor: "#111111", piernasColor: "#222222" });
    expect(furnitureUtils.personaConfig({ colorIdx: 8 }).colorIdx).toBe(2);
  });
});
