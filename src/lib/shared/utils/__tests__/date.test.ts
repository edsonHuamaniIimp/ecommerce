import { describe, expect, it } from "vitest";
import { dateUtils } from "../date";

describe("dateUtils.format", () => {
  it("formatea la fecha en espanol por defecto", () => {
    expect(dateUtils.format("2026-09-30T14:35:00Z")).toMatch(/30/);
    expect(dateUtils.format("2026-09-30T14:35:00Z")).toMatch(/set/i);
  });

  it("formatea la fecha segun el idioma", () => {
    expect(dateUtils.format("2026-09-30T14:35:00Z", { idioma: "en" })).toMatch(/Sep/i);
    expect(dateUtils.format("2026-09-30T14:35:00Z", { idioma: "es" })).toMatch(/set/i);
  });

  it("devuelve guion con valores vacios o invalidos", () => {
    expect(dateUtils.format(null)).toBe("-");
    expect(dateUtils.format("no-es-fecha")).toBe("-");
  });
});

describe("dateUtils.formatDateTime", () => {
  const fecha = new Date("2026-09-30T14:35:00Z");

  it("incluye hora y respeta el idioma", () => {
    expect(dateUtils.formatDateTime(fecha, { idioma: "en" })).toMatch(/Sep/i);
    expect(dateUtils.formatDateTime(fecha, { idioma: "es" })).toMatch(/set/i);
  });

  it("devuelve guion con fecha invalida", () => {
    expect(dateUtils.formatDateTime("no-es-fecha")).toBe("-");
  });
});

describe("dateUtils.formatDateTimeShort", () => {
  it("formatea sin anio", () => {
    const texto = dateUtils.formatDateTimeShort("2026-09-30T14:35:00Z", { idioma: "en" });
    expect(texto).not.toContain("2026");
    expect(texto).toMatch(/Sep/i);
  });
});
