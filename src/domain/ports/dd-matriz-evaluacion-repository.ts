import type {
  DdMatrizAdjuntoCreacion,
  DdMatrizAdjuntoEntity,
  DdMatrizListarParams,
  DdMatrizListarResult,
  DdMatrizVinculoCambios,
  DdMatrizVinculoEntity,
  DdMatrizVinculoManual,
} from "@/domain/models/dd-matriz-evaluacion";

/** Puerto de persistencia de la Matriz de evaluacion DD (vinculos y adjuntos). */
export interface IDdMatrizEvaluacionRepository {
  /**
   * Crea las filas automaticas que falten (empresa, representante y beneficiarios de
   * cada expediente enviado del evento) y refresca los datos de identificacion de las
   * existentes. Es idempotente. Devuelve cuantas filas nuevas creo.
   */
  sincronizarEvento(eventoId: string, usuario: string): Promise<number>;
  listar(params: DdMatrizListarParams): Promise<DdMatrizListarResult>;
  findVinculo(id: string): Promise<DdMatrizVinculoEntity | null>;
  /** Vinculos del mismo expediente (el de empresa aporta los datos generales). */
  findVinculoEmpresa(expedienteId: string): Promise<DdMatrizVinculoEntity | null>;
  existeExpedienteEnEvento(expedienteId: string, eventoId: string): Promise<boolean>;
  actualizarVinculo(id: string, cambios: DdMatrizVinculoCambios): Promise<DdMatrizVinculoEntity>;
  crearVinculoManual(data: DdMatrizVinculoManual): Promise<DdMatrizVinculoEntity>;
  eliminarVinculoManual(id: string): Promise<void>;

  listarAdjuntos(vinculoId: string): Promise<DdMatrizAdjuntoEntity[]>;
  findAdjunto(id: string): Promise<DdMatrizAdjuntoEntity | null>;
  crearAdjunto(data: DdMatrizAdjuntoCreacion): Promise<DdMatrizAdjuntoEntity>;
  eliminarAdjunto(id: string): Promise<void>;

  /** Registra una accion de la matriz en `audit_log` (tipo debida_diligencia). */
  registrarAuditoria(accion: string, entidad: string, actor: string, mensaje: string): Promise<void>;
}
