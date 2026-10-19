import type { DdEstado, DdEstadoEvaluacion, DdResultado } from "@/lib/shared/constants";

/** Estado de Debida Diligencia de la empresa de una solicitud. */
export interface SolicitudDdEstadoDTO {
  solicitudId: string;
  empresaId: string | null;
  empresaRazonSocial: string | null;
  expedienteId: string | null;
  codigo: string | null;
  estado: DdEstado | null;
  resultado: DdResultado;
  estadoEvaluacion: DdEstadoEvaluacion | null;
  vigente: boolean;
  aptoParaContratar: boolean;
  mensaje: string | null;
}
