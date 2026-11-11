export interface DdClasificarArchivosVinculoDTO {
  id: string;
  nombre: string;
  tipo: string;
}

export interface DdClasificarArchivosArchivoDTO {
  nombre: string;
}

/** Solicitud de sugerencias para clasificar archivos por nombre (sin leer su contenido). */
export interface DdClasificarArchivosRequestDTO {
  empresa: {
    id: string;
    razonSocial: string;
    ruc: string;
  };
  vinculos: DdClasificarArchivosVinculoDTO[];
  archivos: DdClasificarArchivosArchivoDTO[];
}
