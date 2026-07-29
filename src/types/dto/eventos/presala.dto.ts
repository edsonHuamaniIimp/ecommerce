export interface EventoPresalaDTO {
  id: string;
  anio: string;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  imagen: string | null;
}

export interface EventoPadrePresalaDTO {
  id: string;
  nombre: string;
  codigo: string;
  vertical: string;
  versiones: EventoPresalaDTO[];
}
