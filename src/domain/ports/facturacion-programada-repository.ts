import type { EstadoFacturacionProgramada } from "@/lib/shared/constants";

export interface FacturacionProgramadaEntity {
  id: string;
  solicitudId: string;
  cuotaId: string;
  /** ISO 8601 (UTC). */
  fechaProgramada: string;
  requisitos: unknown;
  archivos: unknown;
  estado: EstadoFacturacionProgramada;
  ultimoError: string | null;
  createdBy: string | null;
}

export interface ProgramarFacturaData {
  solicitudId: string;
  cuotaId: string;
  fechaProgramada: Date;
  requisitos: unknown;
  archivos: unknown;
  createdBy: string | null;
}

export interface IFacturacionProgramadaRepository {
  /** Reemplaza la tarea pendiente/con error de la solicitud por una nueva. */
  programar(data: ProgramarFacturaData): Promise<FacturacionProgramadaEntity>;
  /** Tarea vigente (pendiente, procesando o con error) de cada solicitud. */
  vigentesPorSolicitudes(solicitudIds: string[]): Promise<FacturacionProgramadaEntity[]>;
  /** Cancela la tarea pendiente o con error de la solicitud. Devuelve cuantas cancelo. */
  cancelar(solicitudId: string): Promise<number>;
  /** Tareas pendientes cuya fecha ya llego (mas antiguas primero). */
  listarVencidas(ahora: Date, limite: number): Promise<FacturacionProgramadaEntity[]>;
  /** Toma la tarea para ejecutarla (pendiente -> procesando); false si otro proceso la tomo. */
  tomar(id: string): Promise<boolean>;
  marcarEjecutada(id: string): Promise<void>;
  marcarError(id: string, mensaje: string): Promise<void>;
}
