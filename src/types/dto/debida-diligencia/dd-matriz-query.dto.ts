/** Filtros de la matriz de empresas del panel. */
export interface DdMatrizQueryDTO {
  eventoId?: string;
  page?: number;
  perPage?: number;
  search?: string;
  estado?: string;
  vinculo?: string;
  multiples?: string;
}
