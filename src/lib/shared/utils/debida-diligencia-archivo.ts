import { DD_DOCUMENTO_EXTENSIONES, DD_DOCUMENTO_MAX_BYTES } from "@/lib/shared/constants";
import { archivoUtils } from "./archivo";

export const DD_FORMATOS_ARCHIVO = {
  PDF: "pdf",
  JPG: "jpg",
  PNG: "png",
} as const;

export type DdFormatoArchivo = (typeof DD_FORMATOS_ARCHIVO)[keyof typeof DD_FORMATOS_ARCHIVO];

/** Detecta el formato real por firma binaria (no confia en el nombre ni en el MIME). */
function detectarFormato(bytes: Uint8Array): DdFormatoArchivo | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return DD_FORMATOS_ARCHIVO.PDF;
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return DD_FORMATOS_ARCHIVO.JPG;
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return DD_FORMATOS_ARCHIVO.PNG;
  }
  return null;
}

function formatoDesdeNombre(nombre: string): DdFormatoArchivo | null {
  const extension = archivoUtils.extensionDeArchivo(nombre);
  if (extension === "pdf") return DD_FORMATOS_ARCHIVO.PDF;
  if (extension === "jpg" || extension === "jpeg") return DD_FORMATOS_ARCHIVO.JPG;
  if (extension === "png") return DD_FORMATOS_ARCHIVO.PNG;
  return null;
}

/** Utilidades de validacion de archivos del modulo DD (frontend y backend). */
export const ddArchivoUtils = {
  /** Nombre de archivo seguro a partir de una URL interna `/uploads/<filename>`. */
  nombreDesdeUrl(url: string): string | null {
    const base = url.split("?")[0]?.trim() ?? "";
    const match = /^\/uploads\/([A-Za-z0-9._-]+)$/.exec(base);
    return match?.[1] ?? null;
  },

  /** Valida nombre, tamano y contenido real de un documento del expediente. */
  validar(datos: { nombre: string; size: number; bytes: Uint8Array }): string | null {
    if (!datos.nombre.trim()) return "El nombre del archivo es obligatorio.";
    if (datos.size <= 0) return "El archivo esta vacio.";
    if (datos.size > DD_DOCUMENTO_MAX_BYTES) {
      return `El archivo supera el maximo de ${DD_DOCUMENTO_MAX_BYTES / 1024 / 1024} MB.`;
    }

    const formatoNombre = formatoDesdeNombre(datos.nombre);
    if (!formatoNombre) {
      return `Formato no permitido. Admitidos: ${DD_DOCUMENTO_EXTENSIONES.join(", ")}.`;
    }

    const formatoReal = detectarFormato(datos.bytes);
    if (!formatoReal) {
      return "El archivo no es un PDF, JPG o PNG válido.";
    }
    if (formatoReal !== formatoNombre) {
      return "La extensión del archivo no coincide con su contenido real.";
    }
    return null;
  },

  /** Valida que el informe legal sea un PDF real. */
  validarInformeLegal(datos: { nombre: string; size: number; bytes: Uint8Array }): string | null {
    const error = ddArchivoUtils.validar(datos);
    if (error) return error;
    if (formatoDesdeNombre(datos.nombre) !== DD_FORMATOS_ARCHIVO.PDF) {
      return "El informe legal debe ser un archivo PDF.";
    }
    return null;
  },

  /** Formato detectado por firma binaria (util para el uploader). */
  detectarFormato(bytes: Uint8Array): DdFormatoArchivo | null {
    return detectarFormato(bytes);
  },
};
