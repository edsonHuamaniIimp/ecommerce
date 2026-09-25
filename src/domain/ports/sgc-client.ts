import type {
  SgcActualizarExpedienteInput,
  SgcConfirmarSubidaResult,
  SgcContractTypesCatalogo,
  SgcCrearExpedienteInput,
  SgcCrearExpedienteResult,
  SgcDocumentoDetalle,
  SgcExpedienteDetalle,
  SgcListarFiltros,
  SgcPaginaExpedientes,
  SgcReservarSubidaInput,
  SgcReservarSubidaResult,
  SgcResendResult,
  SgcTemplate,
  SgcUrlDescarga,
  SgcVersionResuelta,
} from "@/domain/models/sgc";

export interface ISgcClient {
  crearExpediente(input: SgcCrearExpedienteInput, idempotencyKey: string): Promise<SgcCrearExpedienteResult>;
  actualizarExpediente(contractId: string, input: SgcActualizarExpedienteInput): Promise<void>;
  consultarExpediente(contractId: string): Promise<SgcExpedienteDetalle>;
  listarExpedientes(filtros: SgcListarFiltros): Promise<SgcPaginaExpedientes>;
  /** Reabre el tramite tras subir la correccion de una devolucion (subsanacion). */
  reabrirExpediente(contractId: string, idempotencyKey: string): Promise<SgcResendResult>;
  /** Catalogo de tipos de contrato/areas con la ruta vigente — GET /contract-types. */
  listarTiposContrato(): Promise<SgcContractTypesCatalogo>;
  /** Repositorios de templates activos — GET /templates. */
  listarTemplates(): Promise<SgcTemplate[]>;
  /** Un repositorio de templates por codigo — GET /templates/{code}. */
  obtenerTemplate(code: string): Promise<SgcTemplate>;
  reservarSubida(contractId: string, input: SgcReservarSubidaInput): Promise<SgcReservarSubidaResult>;
  transferirArchivo(uploadUrl: string, headers: Record<string, string>, binario: Uint8Array): Promise<void>;
  confirmarSubida(versionId: string): Promise<SgcConfirmarSubidaResult>;
  consultarDocumento(documentId: string): Promise<SgcDocumentoDetalle>;
  resolverVersion(versionId: string): Promise<SgcVersionResuelta>;
  obtenerUrlDescarga(versionId: string): Promise<SgcUrlDescarga>;
}
