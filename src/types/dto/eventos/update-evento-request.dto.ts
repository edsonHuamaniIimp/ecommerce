import type { ModalInfoConfig } from "@/domain/models/entities";

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
  modal_info?: ModalInfoConfig | null;
  /** Soles por dolar; null deshabilita PEN para la version. */
  tipo_cambio?: number | null;
}
