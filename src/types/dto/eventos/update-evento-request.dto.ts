export interface UpdateEventoRequestDTO {
  id?: string;
  tipo_evento?: number;
  codigo_evento?: number;
  estado?: string;
  anio?: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  flg_activo?: boolean;
  flg_visible?: boolean;
  plano?: string;
}
