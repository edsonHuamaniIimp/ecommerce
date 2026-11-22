import {
  DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS,
  DD_MATRIZ_CRITERIO_PREFIJO,
  DD_MATRIZ_LISTAS,
  type DdMatrizAdjuntoCategoria,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";

/** Dato de contexto que la vista previa muestra junto al archivo (quien lo subio, cuando, etc.). */
export interface DdEvidenciaDetalle {
  etiqueta: string;
  valor: string;
}

export interface DatosAdjunto {
  categoria: string;
  nombre: string;
  mimeType?: string | null;
  tamano?: number | null;
  creadoPor?: string | null;
  createdAt?: string | null;
}

export function formatearTamano(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Etiqueta legible de la categoria (`criterio_<codigo>` usa el nombre del criterio). */
export function etiquetaCategoriaAdjunto(categoria: string): string {
  if (categoria.startsWith(DD_MATRIZ_CRITERIO_PREFIJO)) {
    const codigo = categoria.slice(DD_MATRIZ_CRITERIO_PREFIJO.length);
    const lista = DD_MATRIZ_LISTAS.find((item) => item.codigo === codigo);
    return lista ? `Criterio: ${lista.label}` : categoria;
  }
  return DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS[categoria as DdMatrizAdjuntoCategoria] ?? categoria;
}

export function formatoDeArchivo(nombre: string, mimeType?: string | null): string {
  const extension = nombre.includes(".") ? nombre.split(".").pop() : null;
  if (extension && extension.length <= 5) return extension.toUpperCase();
  return mimeType?.split("/").pop()?.toUpperCase() ?? "—";
}

export const ddEvidenciaDetalles = {
  /** Detalles de un adjunto de la matriz (evidencia por criterio, sustento, informe). */
  deAdjunto(adjunto: DatosAdjunto): DdEvidenciaDetalle[] {
    const detalles: DdEvidenciaDetalle[] = [
      { etiqueta: "Tipo", valor: etiquetaCategoriaAdjunto(adjunto.categoria) },
      { etiqueta: "Subido por", valor: adjunto.creadoPor?.trim() || "—" },
      { etiqueta: "Fecha de carga", valor: adjunto.createdAt ? dateUtils.formatDateTime(adjunto.createdAt) : "—" },
      { etiqueta: "Formato", valor: formatoDeArchivo(adjunto.nombre, adjunto.mimeType) },
    ];
    if (adjunto.tamano) detalles.push({ etiqueta: "Tamaño", valor: formatearTamano(adjunto.tamano) });
    return detalles;
  },
};
