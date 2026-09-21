import type {
  SgcActualizarExpedienteInput,
  SgcConfirmarSubidaResult,
  SgcCrearExpedienteInput,
  SgcCrearExpedienteResult,
  SgcDocumentoDetalle,
  SgcExpedienteDetalle,
  SgcListarFiltros,
  SgcPaginaExpedientes,
  SgcReservarSubidaInput,
  SgcReservarSubidaResult,
  SgcUrlDescarga,
  SgcVersionResuelta,
} from "@/domain/models/sgc";

export interface ISgcClient {
  crearExpediente(input: SgcCrearExpedienteInput, idempotencyKey: string): Promise<SgcCrearExpedienteResult>;
  actualizarExpediente(contractId: string, input: SgcActualizarExpedienteInput): Promise<void>;
  consultarExpediente(contractId: string): Promise<SgcExpedienteDetalle>;
  listarExpedientes(filtros: SgcListarFiltros): Promise<SgcPaginaExpedientes>;
  reservarSubida(contractId: string, input: SgcReservarSubidaInput): Promise<SgcReservarSubidaResult>;
  transferirArchivo(uploadUrl: string, headers: Record<string, string>, binario: Uint8Array): Promise<void>;
  confirmarSubida(versionId: string): Promise<SgcConfirmarSubidaResult>;
  consultarDocumento(documentId: string): Promise<SgcDocumentoDetalle>;
  resolverVersion(versionId: string): Promise<SgcVersionResuelta>;
  obtenerUrlDescarga(versionId: string): Promise<SgcUrlDescarga>;
}
