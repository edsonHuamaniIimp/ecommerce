import type { DdMatrizRowDTO } from "./dd-panel.dto";

export interface DdMatrizResponseDTO {
  data: DdMatrizRowDTO[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
