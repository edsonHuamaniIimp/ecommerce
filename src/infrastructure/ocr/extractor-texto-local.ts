import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import PizZip from "pizzip";
import type {
  ExtractorTextoArchivo,
  ExtractorTextoOpciones,
  ExtractorTextoResultado,
  IExtractorTexto,
} from "@/domain/ports/extractor-texto";
import { DD_ASISTENTE, DD_ASISTENTE_MENSAJES, DD_ASISTENTE_METODOS_TEXTO, DD_ASISTENTE_MIME } from "@/lib/shared/constants";
import { ddAsistenteUtils } from "@/lib/shared/utils/dd-asistente";

/** Ejecuta un binario sin shell y devuelve su salida estandar. */
export type EjecutorProceso = (binario: string, args: string[], timeoutMs: number) => Promise<string>;

export interface BinariosOcr {
  tesseract: string;
  pdftotext: string;
  pdftoppm: string;
}

const SALIDA_MAX_BYTES = 32 * 1024 * 1024;
/** Margen minimo para lanzar otro proceso antes de que venza el tiempo del OCR. */
const MARGEN_MS = 1_000;
const PREFIJO_PAGINA = "pagina";
const EXTENSION_PAGINA = ".png";
const SEPARADOR_PAGINAS = "\f";

const ejecutarProceso: EjecutorProceso = (binario, args, timeoutMs) =>
  new Promise((resolve, reject) => {
    execFile(
      binario,
      args,
      { timeout: timeoutMs, maxBuffer: SALIDA_MAX_BYTES, windowsHide: true, killSignal: "SIGKILL", encoding: "utf8" },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    );
  });

/** Rutas de los binarios: variables de entorno, ruta tipica de Windows o el PATH. */
function binariosPorDefecto(): BinariosOcr {
  const tesseractWindows = "C:\\Program Files\\Tesseract-OCR\\tesseract.exe";
  return {
    tesseract:
      process.env.TESSERACT_PATH?.trim() ||
      (process.platform === "win32" && existsSync(tesseractWindows) ? tesseractWindows : "tesseract"),
    pdftotext: process.env.PDFTOTEXT_PATH?.trim() || "pdftotext",
    pdftoppm: process.env.PDFTOPPM_PATH?.trim() || "pdftoppm",
  };
}

const ENTIDADES_XML: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Texto plano de un Word (.docx): parrafos, tabulaciones y saltos de linea. */
export function textoDeDocx(bytes: Uint8Array): string {
  const xml = new PizZip(bytes).file("word/document.xml")?.asText() ?? "";
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|amp|lt|gt|quot|apos);/g, (_, entidad: string) =>
      entidad.startsWith("#") ? String.fromCharCode(Number(entidad.slice(1))) : ENTIDADES_XML[entidad]!,
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Numero de pagina de `pagina-3.png` para ordenar las imagenes generadas por pdftoppm. */
function numeroPagina(archivo: string): number {
  return Number(archivo.slice(PREFIJO_PAGINA.length + 1, -EXTENSION_PAGINA.length)) || 0;
}

/**
 * Extractor de texto en el servidor (poppler + Tesseract). Un PDF con capa de texto se lee
 * directo; un PDF escaneado o una imagen pasa por OCR. Nada sale del servidor.
 */
export class ExtractorTextoLocal implements IExtractorTexto {
  private disponibilidad: Promise<boolean> | null = null;

  constructor(
    private readonly ejecutar: EjecutorProceso = ejecutarProceso,
    private readonly binarios: BinariosOcr = binariosPorDefecto(),
  ) {}

  ocrDisponible(): Promise<boolean> {
    this.disponibilidad ??= Promise.all([
      this.ejecutar(this.binarios.tesseract, ["--version"], DD_ASISTENTE.TIMEOUT_OCR_MS),
      this.ejecutar(this.binarios.pdftotext, ["-v"], DD_ASISTENTE.TIMEOUT_OCR_MS),
      this.ejecutar(this.binarios.pdftoppm, ["-v"], DD_ASISTENTE.TIMEOUT_OCR_MS),
    ])
      .then(() => true)
      .catch(() => false);
    return this.disponibilidad;
  }

  async extraer(archivo: ExtractorTextoArchivo, opciones: ExtractorTextoOpciones): Promise<ExtractorTextoResultado> {
    const mime = ddAsistenteUtils.mimeSoportado(archivo.mimeType, archivo.fileName);
    if (mime === DD_ASISTENTE_MIME.DOCX) {
      return { texto: textoDeDocx(archivo.bytes), paginas: 1, metodo: DD_ASISTENTE_METODOS_TEXTO.DOCX };
    }
    if (mime !== DD_ASISTENTE_MIME.PDF && !ddAsistenteUtils.esImagen(mime)) {
      throw new Error(DD_ASISTENTE_MENSAJES.FORMATO_NO_SOPORTADO);
    }

    const vence = Date.now() + opciones.timeoutMs;
    const dir = await mkdtemp(path.join(os.tmpdir(), "dd-ocr-"));
    try {
      if (mime === DD_ASISTENTE_MIME.PDF) return await this.extraerPdf(archivo.bytes, dir, opciones.maxPaginas, vence);
      const imagen = path.join(dir, `evidencia${path.extname(archivo.fileName) || EXTENSION_PAGINA}`);
      await writeFile(imagen, archivo.bytes);
      const texto = await this.ocr(imagen, vence);
      return { texto, paginas: 1, metodo: DD_ASISTENTE_METODOS_TEXTO.OCR };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private restante(vence: number): number {
    return vence - Date.now();
  }

  private ocr(imagen: string, vence: number): Promise<string> {
    return this.ejecutar(
      this.binarios.tesseract,
      [imagen, "stdout", "-l", DD_ASISTENTE.OCR_IDIOMAS],
      Math.max(MARGEN_MS, this.restante(vence)),
    );
  }

  private async extraerPdf(
    bytes: Uint8Array,
    dir: string,
    maxPaginas: number,
    vence: number,
  ): Promise<ExtractorTextoResultado> {
    const entrada = path.join(dir, "evidencia.pdf");
    await writeFile(entrada, bytes);
    const ultima = String(maxPaginas);

    /* Capa de texto: los PDF impresos desde un portal (evidencias automatizadas) ya la traen.
     * `-enc UTF-8`: por defecto pdftotext escribe Latin-1 y las tildes llegarian rotas. */
    const capa = await this.ejecutar(
      this.binarios.pdftotext,
      ["-enc", "UTF-8", "-layout", "-f", "1", "-l", ultima, entrada, "-"],
      Math.max(MARGEN_MS, this.restante(vence)),
    );
    const paginasCapa = Math.max(1, capa.split(SEPARADOR_PAGINAS).filter((pagina) => pagina.trim()).length);
    if (capa.replace(/\s+/g, "").length >= DD_ASISTENTE.TEXTO_PDF_MIN_POR_PAGINA * paginasCapa) {
      return { texto: capa.trim(), paginas: paginasCapa, metodo: DD_ASISTENTE_METODOS_TEXTO.TEXTO_PDF };
    }

    /* PDF escaneado: cada pagina a imagen y OCR, hasta que se acabe el tiempo. */
    await this.ejecutar(
      this.binarios.pdftoppm,
      ["-r", String(DD_ASISTENTE.OCR_DPI), "-gray", "-png", "-f", "1", "-l", ultima, entrada, path.join(dir, PREFIJO_PAGINA)],
      Math.max(MARGEN_MS, this.restante(vence)),
    );
    const imagenes = (await readdir(dir))
      .filter((archivo) => archivo.startsWith(PREFIJO_PAGINA) && archivo.endsWith(EXTENSION_PAGINA))
      .sort((a, b) => numeroPagina(a) - numeroPagina(b));

    const textos: string[] = [];
    for (const imagen of imagenes) {
      if (this.restante(vence) < MARGEN_MS) break;
      textos.push((await this.ocr(path.join(dir, imagen), vence)).trim());
    }
    return { texto: textos.join(`\n${SEPARADOR_PAGINAS}`).trim(), paginas: textos.length, metodo: DD_ASISTENTE_METODOS_TEXTO.OCR };
  }
}
