import type {
  DdMatrizAdjuntoCreacion,
  DdMatrizAdjuntoEntity,
  DdMatrizExportarParams,
  DdMatrizExportItem,
  DdMatrizListarParams,
  DdMatrizResumenEntity,
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
  /** Indicadores de toda la matriz del evento (para los stats). */
  resumen(eventoId: string): Promise<DdMatrizResumenEntity>;
  /** Vinculos completos (con datos de su empresa) para exportar a Excel. */
  listarParaExportar(params: DdMatrizExportarParams): Promise<DdMatrizExportItem[]>;
  findVinculo(id: string): Promise<DdMatrizVinculoEntity | null>;
  /** Vinculos del mismo expediente (el de empresa aporta los datos generales). */
  findVinculoEmpresa(expedienteId: string): Promise<DdMatrizVinculoEntity | null>;
  /** Evento al que pertenece el expediente; null si no existe o es borrador. */
  findEventoIdDeExpediente(expedienteId: string): Promise<string | null>;
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
