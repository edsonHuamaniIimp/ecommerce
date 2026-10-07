/** Resultado de registrar la relacion usuario (persona) - empresa. */
export interface ResultadoRegistroEmpresaDTO {
  email: string;
  emailEnviado: boolean;
  /** sie_code de la empresa en servicio-persona. */
  sieCodeEmpresa: string;
  /** sie_code de la persona de contacto en servicio-persona. */
  sieCodePersona: string;
  /** true = la empresa se creo en la fuente en esta llamada. */
  empresaCreadaEnFuente: boolean;
  /** true = la empresa ya existia en la fuente con datos distintos y se actualizo. */
  empresaActualizadaEnFuente: boolean;
  /** true = la persona se creo en la fuente en esta llamada. */
  personaCreadaEnFuente: boolean;
  /** FK de la ficha contractual local por RUC (null si no aplica). */
  empresaId: string | null;
}
