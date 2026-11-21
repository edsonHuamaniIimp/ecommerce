/** Candidato a recordatorio de facturacion en la bandeja de Contabilidad. */
export interface RecordatorioCandidatoDTO {
  facturacionId: string;
  solicitudId: string;
  tipoSolicitud: string | null;
  empresa: string | null;
  email: string | null;
  standCode: string;
  moneda: string;
  cuotasPendientes: number;
  montoPendiente: number;
  /** Tipos declarados que aun no se registran en la cuenta corriente del IIMP. */
  faltantes: string[];
}
