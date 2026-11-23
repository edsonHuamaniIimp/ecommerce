import { DD_MATRIZ_AREAS_CONCLUSION } from "@/lib/shared/constants";
import type { DdMatrizAreaConclusion } from "@/lib/shared/constants";

/** Campos de la fila de la matriz que definen si un vinculo tiene su revision terminada. */
export interface DdFilaConclusion {
  id: string;
  expedienteId: string;
  nombre: string;
  tipo: string;
  tipoDocumento?: string | null;
  sigResultado: string | null;
  sigConclusion: string | null;
  repResultado: string | null;
  repConclusion: string | null;
}

export interface DdVinculoSinConclusion {
  id: string;
  nombre: string;
  tipo: string;
  tipoDocumento?: string | null;
  /** Areas que aun no registran resultado y conclusion final en el vinculo. */
  faltan: DdMatrizAreaConclusion[];
}

const lleno = (valor: string | null | undefined): boolean => Boolean(valor && valor.trim());

/**
 * Vinculos (empresa incluida) que aun no tienen resultado y conclusion final de SIG y de
 * Reputacional. Antes de derivar a Legal se avisa de ellos.
 */
export function vinculosSinConclusionFinal(filas: DdFilaConclusion[]): DdVinculoSinConclusion[] {
  const pendientes: DdVinculoSinConclusion[] = [];
  for (const fila of filas) {
    const faltan: DdMatrizAreaConclusion[] = [];
    if (!lleno(fila.sigResultado) || !lleno(fila.sigConclusion)) faltan.push(DD_MATRIZ_AREAS_CONCLUSION.SIG);
    if (!lleno(fila.repResultado) || !lleno(fila.repConclusion)) faltan.push(DD_MATRIZ_AREAS_CONCLUSION.REPUTACIONAL);
    if (faltan.length > 0) {
      pendientes.push({ id: fila.id, nombre: fila.nombre, tipo: fila.tipo, tipoDocumento: fila.tipoDocumento, faltan });
    }
  }
  return pendientes;
}

/** Agrupa por expediente los vinculos pendientes (clave: expedienteId). */
export function pendientesPorExpediente(filas: DdFilaConclusion[]): Map<string, DdVinculoSinConclusion[]> {
  const mapa = new Map<string, DdVinculoSinConclusion[]>();
  for (const expedienteId of new Set(filas.map((f) => f.expedienteId))) {
    const pendientes = vinculosSinConclusionFinal(filas.filter((f) => f.expedienteId === expedienteId));
    if (pendientes.length > 0) mapa.set(expedienteId, pendientes);
  }
  return mapa;
}
