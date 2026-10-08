import fs from "node:fs";
import path from "node:path";

/** Lee la imagen de la fuente local (`/uploads/*`) o remota (http) para enviarla a servicio-persona. */
export async function leerImagenFuente(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith("http")) {
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    if (url.startsWith("/uploads/")) {
      return fs.readFileSync(path.join(process.cwd(), "public", url));
    }
    return null;
  } catch {
    return null;
  }
}

/** Tipo de imagen por magic bytes (JPG/PNG/WEBP); null si no es una imagen soportada. */
export function tipoImagen(buffer: Buffer): string | null {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return "image/webp";
  return null;
}
