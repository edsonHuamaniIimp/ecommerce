import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

/**
 * Anexa PDFs estaticos al final del contrato (Fichas de Reglamento y Fichas IPD).
 * Usa `copyPages`: las paginas se copian tal cual (mismo diseno, distribucion y
 * calidad; sin re-render ni recomprimir). Un anexo ilegible se omite para no
 * bloquear la generacion del contrato.
 */
export async function concatenarAnexosPdf(contrato: Buffer, rutasRelativas: string[]): Promise<Buffer> {
  const doc = await PDFDocument.load(contrato);
  for (const relativa of rutasRelativas) {
    try {
      const bytes = fs.readFileSync(path.join(process.cwd(), "plantillas", relativa));
      const anexo = await PDFDocument.load(bytes);
      const paginas = await doc.copyPages(anexo, anexo.getPageIndices());
      for (const pagina of paginas) doc.addPage(pagina);
    } catch {
      /* Anexo omitido: el contrato sigue siendo valido. */
    }
  }
  return Buffer.from(await doc.save());
}
