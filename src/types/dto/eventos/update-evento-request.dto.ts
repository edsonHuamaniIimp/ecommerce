export interface UpdateEventoRequestDTO {
  estado?: string;
  anio?: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  flg_activo?: boolean;
}
