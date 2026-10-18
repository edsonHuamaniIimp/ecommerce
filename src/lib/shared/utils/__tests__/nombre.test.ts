import { describe, expect, it } from "vitest";
import { nombreCompleto } from "../nombre";

describe("nombreCompleto", () => {
  it("une nombres y apellidos cuando son partes distintas", () => {
    expect(nombreCompleto("JUAN BERNARDO", "RAMIREZ MARTINEZ")).toBe("JUAN BERNARDO RAMIREZ MARTINEZ");
  });

  it("no duplica apellidos si el nombre ya viene completo", () => {
    expect(nombreCompleto("LORENA NILDA BALLON RONCALLA", "BALLON RONCALLA")).toBe("LORENA NILDA BALLON RONCALLA");
  });

  it("tolera campos vacios", () => {
    expect(nombreCompleto("", "APELLIDO")).toBe("APELLIDO");
    expect(nombreCompleto("NOMBRE", null)).toBe("NOMBRE");
    expect(nombreCompleto(null, null)).toBeNull();
  });
});