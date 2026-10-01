import { describe, expect, it } from "vitest";
import { archivoUtils } from "../archivo";

describe("archivoUtils.esPdf", () => {
  it("detecta PDFs por extension", () => {
    expect(archivoUtils.esPdf("/uploads/plano.pdf")).toBe(true);
    expect(archivoUtils.esPdf("/uploads/PLANO.PDF")).toBe(true);
    expect(archivoUtils.esPdf("/uploads/plano.pdf?v=2")).toBe(true);
  });

  it("rechaza imagenes, vacios y nulos", () => {
    expect(archivoUtils.esPdf("/uploads/plano.jpg")).toBe(false);
    expect(archivoUtils.esPdf("https://cdn.x/plano.png")).toBe(false);
    expect(archivoUtils.esPdf("")).toBe(false);
    expect(archivoUtils.esPdf(null)).toBe(false);
    expect(archivoUtils.esPdf(undefined)).toBe(false);
  });
});
