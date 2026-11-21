import { describe, expect, it } from "vitest";
import { normalizarPabellon } from "../pabellon";

describe("normalizarPabellon", () => {
  it("repara el caracter CP437 que sustituye a la O acentuada", () => {
    expect(normalizarPabellon("PABELLËN AZUL")).toBe("PABELLÓN AZUL");
    expect(normalizarPabellon("Pabellën Azul")).toBe("Pabellón Azul");
  });

  it("devuelve null para valores vacios", () => {
    expect(normalizarPabellon(null)).toBeNull();
    expect(normalizarPabellon("   ")).toBeNull();
  });
});
