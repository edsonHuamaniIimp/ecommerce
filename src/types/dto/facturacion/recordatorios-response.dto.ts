import type { RecordatorioCandidatoDTO } from "./recordatorio-candidato.dto";

/** Respuesta de GET `/api/facturacion/recordatorios`. */
export interface RecordatoriosResponseDTO {
  /** Empresas con pagos pendientes que aun no registraron su solicitud de factura. */
  sinSolicitud: RecordatorioCandidatoDTO[];
  /** Empresas con solicitud declarada que no subieron los documentos exigidos. */
  documentosPendientes: RecordatorioCandidatoDTO[];
  /** Empresas cuya cuenta corriente no se pudo consultar en el IIMP. */
  noVerificados: number;
}
