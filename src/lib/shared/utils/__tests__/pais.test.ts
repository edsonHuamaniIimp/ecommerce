import { describe, expect, it } from "vitest";
import { nombrePais, paisDeTexto } from "../pais";

describe("paisDeTexto (mapper de pais: ISO, nombre y gentilicio)", () => {
  it("acepta codigo ISO alpha-2 y alpha-3 en cualquier caja", () => {
    expect(paisDeTexto("PE")).toBe("PE");
    expect(paisDeTexto("pe")).toBe("PE");
    expect(paisDeTexto("CHL")).toBe("CL");
  });

  it("acepta nombre en espanol e ingles, con o sin tilde", () => {
    expect(paisDeTexto("Perú")).toBe("PE");
    expect(paisDeTexto("Peru")).toBe("PE");
    expect(paisDeTexto("PERÚ")).toBe("PE");
    expect(paisDeTexto("Chile")).toBe("CL");
    expect(paisDeTexto("United States")).toBe("US");
    expect(paisDeTexto("Estados Unidos")).toBe("US");
    expect(paisDeTexto("Sudafrica")).toBe("ZA");
  });

  it("acepta gentilicios en masculino y femenino", () => {
    expect(paisDeTexto("Peruana")).toBe("PE");
    expect(paisDeTexto("peruano")).toBe("PE");
    expect(paisDeTexto("Chilena")).toBe("CL");
    expect(paisDeTexto("Argentino")).toBe("AR");
    expect(paisDeTexto("Estadounidense")).toBe("US");
    expect(paisDeTexto("Española")).toBe("ES");
    expect(paisDeTexto("Colombiano")).toBe("CO");
  });

  it("devuelve null para vacio o desconocido", () => {
    expect(paisDeTexto("")).toBeNull();
    expect(paisDeTexto(null)).toBeNull();
    expect(paisDeTexto("Atlantida")).toBeNull();
    expect(paisDeTexto("--")).toBeNull();
  });
});

describe("nombrePais", () => {
  it("devuelve el nombre en espanol o el propio codigo si no existe", () => {
    expect(nombrePais("PE")).toBe("Perú");
    expect(nombrePais("ZZ")).toBe("ZZ");
    expect(nombrePais(null)).toBe("");
  });
});
