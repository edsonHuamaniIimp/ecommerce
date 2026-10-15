import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { concatenarAnexosPdf } from "../anexos-pdf";

const ANEXOS = ["anexos/fichas-reglamento-perumin38.pdf", "anexos/fichas-ipd-perumin38.pdf"];

/** PDF de prueba tipo contrato: paginas A4 verticales. */
async function pdfBase(paginas: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) doc.addPage([595, 842]);
  return Buffer.from(await doc.save());
}

describe("concatenarAnexosPdf", () => {
  it("agrega los anexos al final conservando las paginas del contrato", async () => {
    const resultado = await concatenarAnexosPdf(await pdfBase(2), ANEXOS);
    const doc = await PDFDocument.load(resultado);

    /* 2 del contrato + 12 fichas reglamento + 1 ficha IPD. */
    expect(doc.getPageCount()).toBe(2 + 12 + 1);

    /* Las primeras paginas siguen siendo las del contrato (A4 vertical). */
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
    expect(Math.round(doc.getPage(0).getHeight())).toBe(842);

    /* La ultima pagina es la ficha IPD (A4 horizontal). */
    const ultima = doc.getPage(doc.getPageCount() - 1);
    expect(Math.round(ultima.getWidth())).toBe(842);
    expect(Math.round(ultima.getHeight())).toBe(595);
  });

  it("omite un anexo inexistente sin romper el contrato", async () => {
    const resultado = await concatenarAnexosPdf(await pdfBase(1), ["anexos/no-existe.pdf", ...ANEXOS]);
    const doc = await PDFDocument.load(resultado);
    expect(doc.getPageCount()).toBe(1 + 12 + 1);
  });
});
