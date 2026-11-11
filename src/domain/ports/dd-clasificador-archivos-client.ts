export interface DdClasificadorArchivoEntrada {
  nombre: string;
}

export interface DdClasificadorVinculoEntrada {
  id: string;
  nombre: string;
  tipo: string;
}

export interface DdClasificadorSugerencia {
  indice: number;
  vinculoId: string | null;
  categoria: string;
  confianza: number;
  motivo: string;
}

export interface IDdClasificadorArchivosClient {
  disponible(): boolean;
  clasificar(datos: {
    empresa: { id: string; razonSocial: string; ruc: string };
    vinculos: DdClasificadorVinculoEntrada[];
    archivos: DdClasificadorArchivoEntrada[];
  }): Promise<DdClasificadorSugerencia[] | null>;
}
