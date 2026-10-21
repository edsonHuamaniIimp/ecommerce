/** Filtros de la bandeja de Logistica. */
export interface DdBandejaQueryDTO {
  page?: number;
  perPage?: number;
  search?: string;
  estado?: string;
  origen?: string;
  vinculo?: string;
  documentos?: string;
  reputacion?: string;
  asignacion?: string;
}
