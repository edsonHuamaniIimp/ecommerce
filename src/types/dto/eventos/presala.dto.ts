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
}

export interface EventoPadrePresalaDTO {
  id: string;
  nombre: string;
  codigo: string;
  vertical: string;
  versiones: EventoPresalaDTO[];
}
