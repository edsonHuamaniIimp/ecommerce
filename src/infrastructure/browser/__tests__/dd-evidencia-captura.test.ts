import { describe, expect, it } from "vitest";
import { separarNombreInterpol } from "../dd-evidencia-captura";

describe("separarNombreInterpol", () => {
  it("toma las dos ultimas palabras como apellidos", () => {
    expect(separarNombreInterpol("CARLOS EDUARDO SILVA ROCHA")).toEqual({ apellido: "SILVA ROCHA", nombre: "CARLOS EDUARDO" });
    expect(separarNombreInterpol("JUAN PEREZ LOPEZ")).toEqual({ apellido: "PEREZ LOPEZ", nombre: "JUAN" });
  });
  it("con dos palabras la ultima es el apellido", () => {
    expect(separarNombreInterpol("JOHN SMITH")).toEqual({ apellido: "SMITH", nombre: "JOHN" });
  });
  it("con una palabra no hay nombre", () => {
    expect(separarNombreInterpol("  SMITH ")).toEqual({ apellido: "SMITH", nombre: "" });
  });
});
