export interface DdClasificarArchivosSugerenciaDTO {
  indice: number;
  vinculoId: string | null;
  categoria: string;
  confianza: number;
  motivo: string;
}

export interface DdClasificarArchivosResponseDTO {
  origen: "ia" | "reglas";
  sugerencias: DdClasificarArchivosSugerenciaDTO[];
}
