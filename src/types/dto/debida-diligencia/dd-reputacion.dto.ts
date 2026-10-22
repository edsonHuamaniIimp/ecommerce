import type { DdReputacionEstado, DdReputacionResultado } from "@/lib/shared/constants";

/** Solo el nombre visible: Comunicaciones no accede a la ficha completa del cliente. */
export interface DdReputacionEmpresaDTO {
  razonSocial: string;
}

export interface DdReputacionRowDTO {
  id: string;
  expedienteId: string;
  codigo: string;
  empresa: DdReputacionEmpresaDTO;
  nombreARevisar: string;
  sitioWeb: string | null;
  estado: DdReputacionEstado;
  resultado: DdReputacionResultado | null;
  comentario: string | null;
  linkHallazgos: string | null;
  derivadoPor: string;
  fechaDerivacion: string;
  revisor: string | null;
  fechaCierre: string | null;
  observacionesAbiertas: number;
}

export interface DdReputacionGrupoDTO {
  expedienteId: string;
  codigo: string;
  empresa: DdReputacionEmpresaDTO;
  casos: DdReputacionRowDTO[];
  totalCasos: number;
  pendientes: number;
  cerrados: number;
  fechaDerivacion: string;
}

export interface DdReputacionResponseDTO {
  data: DdReputacionGrupoDTO[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
