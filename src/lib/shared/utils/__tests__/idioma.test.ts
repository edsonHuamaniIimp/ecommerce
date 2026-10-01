import { describe, expect, it } from "vitest";
import { IDIOMAS, IDIOMA_DEFAULT } from "@/lib/shared/constants";
import { esIdioma, idiomaODefecto, localeDeIdioma } from "../idioma";

describe("esIdioma", () => {
  it("acepta es y en", () => {
    expect(esIdioma("es")).toBe(true);
    expect(esIdioma("en")).toBe(true);
  });

  it("rechaza valores invalidos", () => {
    expect(esIdioma("pt")).toBe(false);
    expect(esIdioma("")).toBe(false);
    expect(esIdioma(null)).toBe(false);
    expect(esIdioma(undefined)).toBe(false);
    expect(esIdioma(123)).toBe(false);
  });
});

describe("idiomaODefecto", () => {
  it("devuelve el idioma valido tal cual", () => {
    expect(idiomaODefecto("en")).toBe(IDIOMAS.EN);
  });

  it("cae al idioma por defecto (espanol) en valores invalidos", () => {
    expect(idiomaODefecto("fr")).toBe(IDIOMA_DEFAULT);
    expect(idiomaODefecto(null)).toBe(IDIOMA_DEFAULT);
    expect(idiomaODefecto(undefined)).toBe(IDIOMA_DEFAULT);
  });
});

describe("localeDeIdioma", () => {
  it("mapea es/en a locales y cae a es-PE en valores invalidos", () => {
    expect(localeDeIdioma("es")).toBe("es-PE");
    expect(localeDeIdioma("en")).toBe("en-US");
    expect(localeDeIdioma(null)).toBe("es-PE");
    expect(localeDeIdioma("pt")).toBe("es-PE");
  });
});
