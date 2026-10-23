import type { DdExpedienteDTO } from "./dd-expediente.dto";

export interface DdMisExpedientesQueryDTO {
  page?: number;
  perPage?: number;
  search?: string;
  estado?: string;
  eventoId?: string;
}

export interface DdMisExpedientesResponseDTO {
  items: DdExpedienteDTO[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}
