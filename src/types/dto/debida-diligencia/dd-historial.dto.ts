import type { DdHistorialTipo } from "@/lib/shared/constants";

/** Evento del historial visible del expediente. */
export interface DdHistorialItemDTO {
  id: string;
  tipo: DdHistorialTipo;
  tipoLabel: string;
  area: string | null;
  areaLabel: string | null;
  estado: string | null;
  titulo: string;
  detalle: string | null;
  actor: string;
  documentoTipo: string | null;
  documentoTitulo: string | null;
  fecha: string;
  fechaResolucion: string | null;
  metadata: Record<string, unknown> | null;
}

export interface DdHistorialResponseDTO {
  items: DdHistorialItemDTO[];
}
