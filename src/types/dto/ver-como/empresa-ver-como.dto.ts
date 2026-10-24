import type { EstadoEmpresa } from "@/lib/shared/constants";

/** Datos minimos de empresa expuestos al selector "Ver como" del administrador. */
export interface EmpresaVerComoDTO {
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  estado: EstadoEmpresa;
}

/** Resultado paginado minimo de la busqueda de empresas para "Ver como". */
export interface EmpresasVerComoBusquedaDTO {
  data: EmpresaVerComoDTO[];
  total: number;
}
