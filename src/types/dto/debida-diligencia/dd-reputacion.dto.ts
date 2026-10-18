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
  derivadoPor: string;
  fechaDerivacion: string;
  revisor: string | null;
  fechaCierre: string | null;
  observacionesAbiertas: number;
}

export interface DdReputacionResponseDTO {
  data: DdReputacionRowDTO[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
