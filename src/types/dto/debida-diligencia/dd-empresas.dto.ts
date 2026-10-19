export interface DdEmpresaEstadoDTO {
  id: string;
  documento: string;
  razonSocial: string;
  tipoDocumento: string;
  tipoPersona: string;
  motivoEvaluacion: string | null;
  eventoProyecto: string | null;
  resultado: string;
  resultadoLabel: string;
  estadoOrigen: string;
  estadoEvaluacion: string | null;
  estadoEvaluacionLabel: string | null;
  vigente: boolean;
  fechaIngreso: string | null;
  fechaRevision: string | null;
  fechaVencimiento: string | null;
  diasVigenciaRestantes: number | null;
  puedeReservar: boolean;
  puedeAvanzar: boolean;
  mensaje: string;
  origen: string;
}

export interface DdEmpresasResumenDTO {
  total: number;
  aptos: number;
  aptosConObservaciones: number;
  pendientes: number;
  noAptos: number;
  vigentes: number;
  requierenNuevaEvaluacion: number;
}

export interface DdEmpresasResponseDTO {
  items: DdEmpresaEstadoDTO[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
  resumen: DdEmpresasResumenDTO;
}
