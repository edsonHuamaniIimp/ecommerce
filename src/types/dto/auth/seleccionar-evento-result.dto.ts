export interface SeleccionarEventoResult {
  token: string;
  eventoId: string;
  tipoEvento?: number;
  codigoEvento?: number;
  /** Segundos de vigencia restantes, para mantener la cookie alineada al JWT. */
  maxAge: number;
}
