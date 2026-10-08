/** Datos de una persona devueltos por la consulta de documento (RENIEC). */
export interface DniConsulta {
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  nombreCompleto?: string;
}

/** Consulta externa de documentos (RENIEC) usada para completar personas en la fuente. */
export interface IConsultaDocumentoClient {
  consultarDni(numero: string): Promise<DniConsulta>;
}
