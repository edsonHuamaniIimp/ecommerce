/** Filtros de la bandeja de empresas. */
export interface ListarEmpresasQueryDTO {
  page?: number;
  perPage?: number;
  search?: string;
  estado?: string;
}
