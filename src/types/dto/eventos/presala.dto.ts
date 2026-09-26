import type { ModalInfoConfig } from "@/domain/models/entities";

export interface EventoPresalaDTO {
  id: string;
  anio: string;
  estado: string;
  tipoEvento?: number;
  codigoEvento?: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  imagen: string | null;
  plano?: string | null;
  flgVisible?: boolean;
  /** Config del modal informativo de /mapa (solo admin/dashboard). */
  modal_info?: ModalInfoConfig | null;
}

export interface EventoPadrePresalaDTO {
  id: string;
  nombre: string;
  codigo: string;
  vertical: string;
  versiones: EventoPresalaDTO[];
}
