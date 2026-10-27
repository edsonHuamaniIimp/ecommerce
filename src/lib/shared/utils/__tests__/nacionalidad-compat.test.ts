import { describe, expect, it } from "vitest";
import { REGEX_NACIONALIDAD } from "@/lib/shared/constants";
import { paisDeTexto } from "@/lib/shared/utils/pais";

describe("compatibilidad de nacionalidad", () => {
  it.each([
    "PERUANA",
    "peruano",
    "VENEZOLANO",
    "ARGENTINO",
    "EE.UU",
    "NO ESPECIFICADA",
    "14",
    "Perú",
    "PE",
    "Côte d'Ivoire",
    "Bolivia (Estado Plurinacional de)",
  ])("acepta el valor legacy %s", (valor) => {
    expect(REGEX_NACIONALIDAD.test(valor)).toBe(true);
  });

  it("resuelve gentilicios legacy a un código ISO para mostrar la bandera", () => {
    expect(paisDeTexto("PERUANA")).toBe("PE");
    expect(paisDeTexto("VENEZOLANO")).toBe("VE");
    expect(paisDeTexto("Perú")).toBe("PE");
  });
});
