import type { DdExpedienteDTO } from "./dd-expediente.dto";

export interface DdClienteEvaluacionDTO {
  expediente: DdExpedienteDTO;
  resultado: string;
  resultadoLabel: string;
  estadoEvaluacion: string | null;
  estadoEvaluacionLabel: string | null;
  vigente: boolean;
  diasVigenciaRestantes: number | null;
  aptoParaContratar: boolean;
  alcance: string | null;
  observacionesAbiertas: number;
}

export interface DdClientesResumenDTO {
  total: number;
  pendientes: number;
  aptos: number;
  aptosConObservaciones: number;
  noAptos: number;
  vigentes: number;
  requierenNuevaEvaluacion: number;
}

export interface DdClientesResponseDTO {
  items: DdClienteEvaluacionDTO[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
  resumen: DdClientesResumenDTO;
}
