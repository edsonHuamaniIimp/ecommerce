export interface GessStandDTO {
  id: string;
  eventoId: string;
  standApiId: string;
  standCode: string;
  tipoStand: string | null;
  medidas: string | null;
  estado: string | null;
  empresa: string | null;
  pabellon: string | null;
  ubicacion: string | null;
  rawData: unknown;
  bloqueId: string | null;
  email?: string | null;
  userId?: string | null;
  documentos: unknown;
  imagenes: unknown;
  createdAt: string;
  updatedAt: string;
}
