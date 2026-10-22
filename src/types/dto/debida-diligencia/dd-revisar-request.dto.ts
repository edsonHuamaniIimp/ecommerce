import type { DdAccionRevision, DdDocumentoTipo } from "@/lib/shared/constants";

/** Resolucion de Logistica sobre un expediente en revision. */
export interface DdRevisarRequestDTO {
  expedienteId: string;
  accion: DdAccionRevision;
  motivo: string | null;
  /** Link del informe de Logistica entregado a Legal al derivar. */
  informeLogisticaUrl?: string | null;
  documentosObservados: DdDocumentoTipo[];
  observaciones: {
    documentoTipo: DdDocumentoTipo | null;
    texto: string;
  }[];
  derivarComunicaciones?: boolean;
}
