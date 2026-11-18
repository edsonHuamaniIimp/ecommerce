import type { DdReputacionOrden } from "@/lib/shared/constants";

/** Filtros de la bandeja de revision reputacional. */
export interface DdReputacionQueryDTO {
  page?: number;
  perPage?: number;
  search?: string;
  estado?: string;
  /** Fecha de envio del SIG en formato YYYY-MM-DD. */
  desde?: string;
  /** Fecha de envio del SIG en formato YYYY-MM-DD. */
  hasta?: string;
  orden?: DdReputacionOrden;
}
