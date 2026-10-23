/** Filtros de la bandeja de Logistica. */
export interface DdBandejaQueryDTO {
  eventoId?: string;
  page?: number;
  perPage?: number;
  search?: string;
  estado?: string;
  origen?: string;
  vinculo?: string;
  documentos?: string;
  reputacion?: string;
  asignacion?: string;
  solicitudes?: string;
  multiples?: string;
  orden?: string;
}
