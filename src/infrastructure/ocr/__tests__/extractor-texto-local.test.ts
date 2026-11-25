import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import { describe, expect, it, vi } from "vitest";
import { ExtractorTextoLocal, textoDeDocx, type EjecutorProceso } from "../extractor-texto-local";
import { DD_ASISTENTE, DD_ASISTENTE_MENSAJES, DD_ASISTENTE_METODOS_TEXTO, DD_ASISTENTE_MIME } from "@/lib/shared/constants";

const BINARIOS = { tesseract: "tesseract", pdftotext: "pdftotext", pdftoppm: "pdftoppm" };
const OPCIONES = { maxPaginas: DD_ASISTENTE.OCR_PAGINAS_MAX, timeoutMs: DD_ASISTENTE.TIMEOUT_OCR_MS };
const PDF = { bytes: new Uint8Array([37, 80, 68, 70]), mimeType: DD_ASISTENTE_MIME.PDF, fileName: "oefa.pdf" };

function docx(xml: string): Uint8Array {
  const zip = new PizZip();
  zip.file("word/document.xml", xml);
  return zip.generate({ type: "uint8array" }) as Uint8Array;
}

describe("ExtractorTextoLocal", () => {
  it("PDF con capa de texto: lo lee directo, sin OCR", async () => {
    const texto = "Resolucion Directoral 123-2025-OEFA. Multa de 10 UIT a la empresa.";
    const ejecutar = vi.fn<EjecutorProceso>().mockResolvedValue(texto);
    const r = await new ExtractorTextoLocal(ejecutar, BINARIOS).extraer(PDF, OPCIONES);
    expect(r).toEqual({ texto, paginas: 1, metodo: DD_ASISTENTE_METODOS_TEXTO.TEXTO_PDF });
    expect(ejecutar).toHaveBeenCalledTimes(1);
    expect(ejecutar.mock.calls[0]![0]).toBe("pdftotext");
    expect(ejecutar.mock.calls[0]![1]).toContain(String(DD_ASISTENTE.OCR_PAGINAS_MAX));
    /* Sin -enc UTF-8, pdftotext escribe Latin-1 y las tildes llegan rotas. */
    expect(ejecutar.mock.calls[0]![1].join(" ")).toContain("-enc UTF-8");
  });

  it("PDF escaneado: cada pagina a imagen y OCR en orden; borra los temporales", async () => {
    let directorio = "";
    const ejecutar = vi.fn<EjecutorProceso>(async (binario, args) => {
      if (binario === "pdftotext") return "\f\f";
      if (binario === "pdftoppm") {
        const prefijo = args[args.length - 1]!;
        directorio = path.dirname(prefijo);
        for (const n of [10, 2, 1]) writeFileSync(`${prefijo}-${n}.png`, "");
        return "";
      }
      return `texto de ${path.basename(args[0]!)}`;
    });
    const r = await new ExtractorTextoLocal(ejecutar, BINARIOS).extraer(PDF, OPCIONES);
    expect(r.metodo).toBe(DD_ASISTENTE_METODOS_TEXTO.OCR);
    expect(r.paginas).toBe(3);
    expect(r.texto.indexOf("pagina-1.png")).toBeLessThan(r.texto.indexOf("pagina-2.png"));
    expect(r.texto.indexOf("pagina-2.png")).toBeLessThan(r.texto.indexOf("pagina-10.png"));
    const ocr = ejecutar.mock.calls.filter(([binario]) => binario === "tesseract");
    expect(ocr[0]![1]).toContain(DD_ASISTENTE.OCR_IDIOMAS);
    expect(existsSync(directorio)).toBe(false);
  });

  it("imagen: OCR directo", async () => {
    const ejecutar = vi.fn<EjecutorProceso>().mockResolvedValue("SANCIONADO");
    const r = await new ExtractorTextoLocal(ejecutar, BINARIOS).extraer(
      { bytes: new Uint8Array([1]), mimeType: DD_ASISTENTE_MIME.PNG, fileName: "captura.png" },
      OPCIONES,
    );
    expect(r).toEqual({ texto: "SANCIONADO", paginas: 1, metodo: DD_ASISTENTE_METODOS_TEXTO.OCR });
    expect(ejecutar.mock.calls[0]![0]).toBe("tesseract");
  });

  it("Word: texto sin herramientas externas", async () => {
    const ejecutar = vi.fn<EjecutorProceso>();
    const r = await new ExtractorTextoLocal(ejecutar, BINARIOS).extraer(
      {
        bytes: docx("<w:document><w:body><w:p><w:r><w:t>Hola &amp; mundo</w:t></w:r></w:p><w:p><w:r><w:t>Linea 2</w:t></w:r></w:p></w:body></w:document>"),
        mimeType: DD_ASISTENTE_MIME.DOCX,
        fileName: "informe.docx",
      },
      OPCIONES,
    );
    expect(r).toEqual({ texto: "Hola & mundo\nLinea 2", paginas: 1, metodo: DD_ASISTENTE_METODOS_TEXTO.DOCX });
    expect(ejecutar).not.toHaveBeenCalled();
  });

  it("formato no soportado: error", async () => {
    const extractor = new ExtractorTextoLocal(vi.fn<EjecutorProceso>(), BINARIOS);
    await expect(
      extractor.extraer({ bytes: new Uint8Array([1]), mimeType: "application/zip", fileName: "x.zip" }, OPCIONES),
    ).rejects.toThrow(DD_ASISTENTE_MENSAJES.FORMATO_NO_SOPORTADO);
  });

  it("OCR no disponible si falta algun binario", async () => {
    const ejecutar = vi.fn<EjecutorProceso>(async (binario) => {
      if (binario === "tesseract") throw new Error("ENOENT");
      return "";
    });
    expect(await new ExtractorTextoLocal(ejecutar, BINARIOS).ocrDisponible()).toBe(false);
    expect(await new ExtractorTextoLocal(vi.fn<EjecutorProceso>().mockResolvedValue("ok"), BINARIOS).ocrDisponible()).toBe(true);
  });

  it("decodifica entidades numericas del Word", () => {
    expect(textoDeDocx(docx("<w:p><w:r><w:t>Se&#241;or</w:t></w:r></w:p>"))).toBe("Señor");
  });
});
