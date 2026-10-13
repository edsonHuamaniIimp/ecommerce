import { describe, expect, it } from "vitest";
import { archivoUtils } from "../archivo";

describe("archivoUtils.extensionDeArchivo", () => {
  it("extrae la extension en minusculas (ignora query del nombre)", () => {
    expect(archivoUtils.extensionDeArchivo("Contrato.PDF")).toBe("pdf");
    expect(archivoUtils.extensionDeArchivo("a.b.docx")).toBe("docx");
  });

  it("devuelve vacio cuando no hay extension valida", () => {
    expect(archivoUtils.extensionDeArchivo("VP SANTIAGO")).toBe("");
    expect(archivoUtils.extensionDeArchivo("documento.")).toBe("");
    expect(archivoUtils.extensionDeArchivo(".oculto")).toBe("");
    expect(archivoUtils.extensionDeArchivo("")).toBe("");
  });
});

describe("archivoUtils.extensionPermitida", () => {
  it("acepta las extensiones del listado global", () => {
    expect(archivoUtils.extensionPermitida("ficha-ruc.pdf")).toBe(true);
    expect(archivoUtils.extensionPermitida("foto.PNG")).toBe(true);
    expect(archivoUtils.extensionPermitida("datos.xlsx")).toBe(true);
  });

  it("rechaza zip y nombres rotos (casos reales de produccion)", () => {
    expect(archivoUtils.extensionPermitida("1791895308462_tlqzey.zip")).toBe(false);
    expect(archivoUtils.extensionPermitida("1791901563980_lumwlg.VP SANTIAGO")).toBe(false);
    expect(archivoUtils.extensionPermitida("archivo.exe")).toBe(false);
  });

  it("respeta una lista personalizada (anexos del wizard)", () => {
    expect(archivoUtils.extensionPermitida("contrato.docx", ["pdf", "jpg", "png"])).toBe(false);
    expect(archivoUtils.extensionPermitida("contrato.docx", ["pdf", "docx"])).toBe(true);
  });
});
