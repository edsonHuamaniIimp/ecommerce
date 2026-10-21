import type { DdEmpresaDTO } from "./dd-expediente.dto";

export interface DdBandejaRowDTO {
  id: string;
  codigo: string;
  estado: string;
  origen: string;
  estadoOrigen: string | null;
  eventoProyecto: string | null;
  motivoImportacion: string | null;
  tipoRelacionComercial: string | null;
  empresa: DdEmpresaDTO;
  fechaCreacion: string | null;
  solicitudesAlquiler: number;
  documentoCargados: number;
  documentoTotal: number;
  fechaEnvio: string | null;
  fechaAprobacion: string | null;
  fechaVencimiento: string | null;
  revisadoPor: string | null;
  motivoRechazo: string | null;
  observacionesAbiertas: number;
  reputacionCasos: number;
  reputacionEstado: string | null;
  reputacionPendientes: number;
  reputacionSinHallazgos: number;
  reputacionConHallazgos: number;
  reputacionRequiereInformacion: number;
}

export interface DdBandejaResumenDTO {
  total: number;
  pendientes: number;
  enRevision: number;
  observadas: number;
  aprobadas: number;
  rechazadas: number;
}

export interface DdBandejaResponseDTO {
  data: DdBandejaRowDTO[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  resumen: DdBandejaResumenDTO;
}
