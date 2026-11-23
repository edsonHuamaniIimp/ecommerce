import type { SgcDocumentoEntity, SgcExpedienteEntity, SgcObservacionDocumento } from "@/domain/models/sgc";
import type {
  SgcDocumentCategory,
  SgcDocumentoEstado,
  SgcEstadoEnvio,
  SgcIntentoOrigen,
  SgcIntentoResultado,
  SgcLifecycleStatus,
  SgcStage,
} from "@/lib/shared/constants";

/** Ronda de subsanación (auditoría: rechazo ? motivo ? corrección ? reenvío). */
export interface SgcSubsanacionEntity {
  id: string;
  sgcExpedienteId: string;
  ronda: number;
  motivo: string;
  /** Modo declarado: `nuevo_contrato` | `mismo_contrato` (null = libre/legacy). */
  modo?: string | null;
  estado: string;
  declaradoPor: string;
  declaradoAt: Date;
  reenviadoPor: string | null;
  reenviadoAt: Date | null;
  documentId: string | null;
  versionId: string | null;
}

export interface CrearSgcExpedienteData {
  solicitudId: string;
  code: string;
  areaCode: string;
  contractTypeCode: string;
}

export interface ActualizarSgcExpedienteData {
  /** Codigo de negocio del expediente (se ajusta con sufijo si el SGC reporta colision global). */
  code?: string;
  /** Codigo de area y tipo de contrato usados en el SGC (se actualizan al recrear). */
  areaCode?: string;
  contractTypeCode?: string;
  contractId?: string | null;
  estadoEnvio?: SgcEstadoEnvio;
  stage?: SgcStage | null;
  lifecycleStatus?: SgcLifecycleStatus | null;
  version?: number | null;
  /** Casuística de subsanación declarada por el admin (null = limpiar). */
  subsanacionMotivo?: string | null;
  /** Modo de la subsanación declarada (null = limpiar). */
  subsanacionModo?: string | null;
  lastSyncedAt?: Date | null;
  lastError?: string | null;
  /** Marca/limpia el bypass admin (aprobado local sin respuesta del SGC). */
  bypassAprobado?: boolean;
  /** Ultima devolucion del SGC: `true` = exige cambio documental (subsanable). */
  devolucionRequiereCambio?: boolean | null;
  /** Motivo (libre) de la ultima devolucion (`data.reason` del webhook). */
  devolucionMotivo?: string | null;
  /** Etapa destino de la devolucion (`null` = origen). */
  devolucionDestinoStepId?: string | null;
  /** Estrategia: `return-to-sender` | `restart-forward`. */
  devolucionEstrategia?: string | null;
  /** Observaciones por documento de la ultima devolucion ([] = limpiar). Campo opcional. */
  observaciones?: SgcObservacionDocumento[] | null;
  contratoRegeneradoObservationId?: string | null;
  contratoRegeneradoAt?: Date | null;
}

export interface CrearSgcDocumentoData {
  sgcExpedienteId: string;
  documentId: string;
  category: SgcDocumentCategory;
  title: string;
  fileName: string;
  checksumSha256: string;
  sizeBytes: number;
}

export interface ActualizarSgcDocumentoData {
  currentVersionId?: string | null;
  estado?: SgcDocumentoEstado;
  /** Se refrescan al subir una nueva version (mantienen la correlacion con la version vigente). */
  title?: string;
  fileName?: string;
  checksumSha256?: string | null;
  sizeBytes?: number | null;
}

/** Un intento de solicitar nueva revision al SGC (ver `sgc_subsanacion_intento`). */
export interface RegistrarIntentoSubsanacionData {
  solicitudId: string;
  origen: SgcIntentoOrigen;
  actor: string | null;
  resultado: SgcIntentoResultado;
  httpStatus: number | null;
  mensaje: string | null;
  sgcLifecycle: string | null;
  sgcStage: string | null;
  requeridos: number | null;
  cubiertos: number | null;
  detalle: Record<string, unknown> | null;
}

export interface ISgcRepository {
  findExpedientePorSolicitud(solicitudId: string): Promise<SgcExpedienteEntity | null>;
  findExpedientePorContractId(contractId: string): Promise<SgcExpedienteEntity | null>;
  listarConContractId(): Promise<SgcExpedienteEntity[]>;
  /** Correlacion local de una pieza por `documentId` del SGC (checksum de la ultima version subida). */
  buscarDocumento?(documentId: string): Promise<SgcDocumentoEntity | null>;
  /** Bitacora de intentos de reenvio/subsanacion (exitos y errores). Best-effort. */
  registrarIntentoSubsanacion?(data: RegistrarIntentoSubsanacionData): Promise<void>;
  listarConEstadoEnvio(estado: SgcEstadoEnvio): Promise<SgcExpedienteEntity[]>;
  crearExpediente(data: CrearSgcExpedienteData): Promise<SgcExpedienteEntity>;
  actualizarExpediente(id: string, data: ActualizarSgcExpedienteData): Promise<SgcExpedienteEntity>;
  /** Bitácora auditable de subsanaciones (una fila por ronda de devolución). */
  crearSubsanacion(data: {
    sgcExpedienteId: string;
    ronda: number;
    motivo: string;
    modo?: string | null;
    declaradoPor: string;
  }): Promise<SgcSubsanacionEntity>;
  listarSubsanaciones(sgcExpedienteId: string): Promise<SgcSubsanacionEntity[]>;
  marcarSubsanacionReenviada(
    id: string,
    data: { reenviadoPor: string; documentId: string | null; versionId: string | null },
  ): Promise<void>;

  crearDocumento(data: CrearSgcDocumentoData): Promise<SgcDocumentoEntity>;
  actualizarDocumento(documentId: string, data: ActualizarSgcDocumentoData): Promise<void>;
}
