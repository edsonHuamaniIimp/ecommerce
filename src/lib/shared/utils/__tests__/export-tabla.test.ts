import { describe, expect, it } from "vitest";
import { csvCelda, exportarTablaCsv, exportarTablaExcel, nombreArchivoExport } from "../export-tabla";

describe("csvCelda", () => {
  it("escapa comillas dobles", () => {
    expect(csvCelda('Empresa "Demo"')).toBe('"Empresa ""Demo"""');
  });

  it("envuelve comas y saltos de linea", () => {
    expect(csvCelda("Lima, Peru")).toBe('"Lima, Peru"');
    expect(csvCelda("linea1\nlinea2")).toBe('"linea1\nlinea2"');
  });

  it("convierte null/undefined en vacio", () => {
    expect(csvCelda(null)).toBe('""');
    expect(csvCelda(undefined)).toBe('""');
  });
});

describe("nombreArchivoExport", () => {
  it("incluye prefijo, fecha y extension", () => {
    expect(nombreArchivoExport("pre-reservas", "csv")).toMatch(/^pre-reservas-\d{8}-\d{4}\.csv$/);
    expect(nombreArchivoExport("pre-reservas", "xlsx")).toMatch(/^pre-reservas-\d{8}-\d{4}\.xlsx$/);
  });
});

describe("exportarTablaCsv", () => {
  it("no falla sin DOM (descarga no-op en SSR)", () => {
    const columnas = [
      { encabezado: "Stand", valor: (r: { stand: string }) => r.stand },
      { encabezado: "Empresa", valor: (r: { empresa: string }) => r.empresa },
    ];
    expect(() => exportarTablaCsv([{ stand: "101", empresa: "ACME, S.A." }], columnas, "demo.csv")).not.toThrow();
  });
});

describe("exportarTablaExcel", () => {
  it("genera el libro sin fallar sin DOM (descarga no-op en SSR)", async () => {
    const columnas = [
      { encabezado: "Stand", valor: (r: { stand: string }) => r.stand },
      { encabezado: "Empresa", valor: (r: { empresa: string }) => r.empresa },
    ];
    await expect(exportarTablaExcel([{ stand: "101", empresa: "ACME" }], columnas, "demo.xlsx")).resolves.toBeUndefined();
  });
});