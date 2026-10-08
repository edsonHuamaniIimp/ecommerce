/** Resultado por empresa de la creacion masiva de cuentas (solo con RUC). */
export interface ResultadoCuentaEmpresaDTO {
  ruc: string;
  razonSocial: string;
  /** Usuario de acceso (RUC) si la cuenta se creo. */
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
