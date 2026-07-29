export interface GessStandDTO {
  id: string;
  evento_id: string;
  stand_api_id: string;
  stand_code: string;
  tipo_stand: string | null;
  medidas: string | null;
  estado: string | null;
  empresa: string | null;
  pabellon: string | null;
  ubicacion: string | null;
  raw_data: unknown;
  bloque_id: string | null;
  created_at: string;
  updated_at: string;
}
