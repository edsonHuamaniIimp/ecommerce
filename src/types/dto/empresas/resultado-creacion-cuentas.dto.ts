/** Resultado por empresa de la creacion masiva de cuentas. */
export interface ResultadoCuentaEmpresaDTO {
  /** Documento de la empresa (RUC o RUT). */
  ruc: string;
  /** Tipo de documento (TIPOS_DOCUMENTO_EMPRESA). */
  tipoDocumento: string;
  razonSocial: string;
  /** Usuario de acceso (documento) si la cuenta se creo. */
  usuario: string | null;
  /** Contrasena temporal (se muestra una vez al administrador). */
  passwordTemporal: string | null;
  creada: boolean;
  error: string | null;
}

/** Resultado de la creacion masiva de cuentas de acceso. */
export interface ResultadoCreacionCuentasEmpresasDTO {
  creadas: number;
  omitidas: number;
  resultados: ResultadoCuentaEmpresaDTO[];
}
