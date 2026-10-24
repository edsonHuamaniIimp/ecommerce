import type { DdAccionRevision, DdAlcanceRevision, DdDocumentoTipo } from "@/lib/shared/constants";

/** Resolucion de Logistica sobre un expediente en revision. */
export interface DdRevisarRequestDTO {
  expedienteId: string;
  /** Expediente completo o solo la declaracion de vigencia. */
  alcance?: DdAlcanceRevision;
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
