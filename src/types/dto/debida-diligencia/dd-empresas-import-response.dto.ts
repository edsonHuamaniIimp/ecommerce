export interface DdEmpresaImportErrorDTO {
  fila: number;
  documento: string;
  mensaje: string;
}

export interface DdEmpresasImportResponseDTO {
  importados: number;
  actualizados: number;
  empresasCreadas: number;
  empresasExistentes: number;
  empresasError: { documento: string; mensaje: string }[];
  omitidos: number;
  errores: DdEmpresaImportErrorDTO[];
}
