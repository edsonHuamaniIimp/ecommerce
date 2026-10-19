export interface DdEmpresaImportErrorDTO {
  fila: number;
  documento: string;
  mensaje: string;
}

export interface DdEmpresasImportResponseDTO {
  importados: number;
  actualizados: number;
  omitidos: number;
  errores: DdEmpresaImportErrorDTO[];
}
