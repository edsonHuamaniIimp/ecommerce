import { readFile } from "fs/promises";
import { basename, resolve, sep } from "path";
import type { DocumentoOrigenContenido, IDocumentoOrigen } from "@/domain/ports/documento-origen";
import { mimeDesdeNombre } from "@/lib/shared/utils/sgc";

const UPLOADS_PREFIX = "/uploads/";

/** Lee documentos de `public/uploads` (local) o de una URL publica. */
export class DocumentoOrigen implements IDocumentoOrigen {
  async leer(url: string): Promise<DocumentoOrigenContenido> {
    if (url.startsWith(UPLOADS_PREFIX)) return this.leerLocal(url);
    if (url.startsWith("http://") || url.startsWith("https://")) return this.leerRemoto(url);
    throw new Error(`Origen de documento no soportado: ${url}`);
  }

  private async leerLocal(url: string): Promise<DocumentoOrigenContenido> {
    const base = resolve(process.cwd(), "public", "uploads");
    const filepath = resolve(process.cwd(), "public", url.replace(/^\//, ""));
    if (filepath !== base && !filepath.startsWith(base + sep)) {
      throw new Error("Ruta de documento invalida");
    }
    const bytes = new Uint8Array(await readFile(filepath));
    return { bytes, mimeType: mimeDesdeNombre(url), fileName: basename(filepath) };
  }

  private async leerRemoto(url: string): Promise<DocumentoOrigenContenido> {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`No se pudo leer el documento origen: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const mimeType = res.headers.get("content-type") ?? mimeDesdeNombre(url);
    return { bytes, mimeType, fileName: basename(new URL(url).pathname) || "documento" };
  }
}

export const documentoOrigen = new DocumentoOrigen();
