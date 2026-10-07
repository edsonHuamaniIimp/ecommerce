/** Datos del exhibidor que van al cuerpo del contrato (paso Cuotas del wizard). */
export interface DatosContratoDTO {
  /** Nombre o razon social del exhibidor. */
  razonSocial?: string;
  /** RUC/RUT/TaxID o equivalente. */
  ruc?: string;
  /** Domicilio del exhibidor. */
  direccion?: string;
  /** Representante legal (nombre completo). */
  representante?: string;
  /** DNI/ID Card/Pasaporte del representante. */
  representanteDni?: string;
  /** Partida electronica de poderes (opcional). */
  partidaElectronica?: string;
}
