import type { EmpresaDTO } from "./empresa.dto";

export interface EmpresasPaginatedDTO {
  data: EmpresaDTO[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
