import type { ISgcClient } from "@/domain/ports/sgc-client";
import { SgcApiError } from "@/domain/models/sgc";
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
  SgcVersion,
  SgcVersionResuelta,
} from "@/domain/models/sgc";
import { SGC_APPROVAL_RESULT, SGC_CREATE_STATUS, SGC_STAGES, SGC_VERSION_STATUS } from "@/lib/shared/constants";

const MOCK_BASE_URL = "https://mock-sgc.local";
const MOCK_EXPIRES_UPLOAD_SECONDS = 300;
const MOCK_EXPIRES_DOWNLOAD_SECONDS = 60;

interface MockDocumento {
  documentId: string;
  contractId: string;
  category: string;
  title: string;
  fileName: string;
  currentVersionId: string | null;
  versions: SgcVersion[];
}

interface SgcMockStore {
  expedientes: Map<string, SgcExpedienteDetalle>;
  documentos: Map<string, MockDocumento>;
  porIdempotency: Map<string, string>;
  secuencia: number;
}

/**
 * El store vive en `globalThis` para sobrevivir a los bundles por ruta de Next dev
 * (cada route handler tiene su propia instancia de módulo). Sin esto, `registrar`
 * y `detalle` usarían mocks distintos y el panel daría 500.
 */
function getStore(): SgcMockStore {
  const g = globalThis as unknown as { __sgcMockStore?: SgcMockStore };
  if (!g.__sgcMockStore) {
    g.__sgcMockStore = { expedientes: new Map(), documentos: new Map(), porIdempotency: new Map(), secuencia: 0 };
  }
  return g.__sgcMockStore;
}

/** Reinicia el store en memoria (usar en tests para aislar). */
export function resetSgcClientMock(): void {
  (globalThis as unknown as { __sgcMockStore?: SgcMockStore }).__sgcMockStore = undefined;
}

/**
 * Adaptador en memoria del cliente SGC. Permite desarrollar y probar el flujo
 * de integracion sin credenciales ni conectividad (SGC_MODE=mock).
 */
export class SgcClientMock implements ISgcClient {
  private readonly expedientes = getStore().expedientes;
  private readonly documentos = getStore().documentos;
  private readonly porIdempotency = getStore().porIdempotency;

  private nuevoId(): string {
    const store = getStore();
    store.secuencia += 1;
    return `mock-${store.secuencia.toString().padStart(12, "0")}`;
  }

  async crearExpediente(input: SgcCrearExpedienteInput, idempotencyKey: string): Promise<SgcCrearExpedienteResult> {
    const existente = this.porIdempotency.get(idempotencyKey);
    if (existente) return { contractId: existente, status: SGC_CREATE_STATUS.CREATED };

    const contractId = this.nuevoId();
    const ahora = new Date().toISOString();
    this.expedientes.set(contractId, {
      contractId,
      code: input.code,
      name: input.name,
      stage: SGC_STAGES.DRAFTING,
      lifecycleStatus: null,
      areaName: null,
      contractTypeName: null,
      counterpartyName: input.counterpartyLegalName,
      counterpartyEmail: null,
      counterpartyTaxIdentifier: input.counterpartyTaxIdentifier,
      currency: null,
      totalMinorUnits: null,
      startDate: null,
      endDate: null,
      version: 1,
      createdAt: ahora,
      updatedAt: ahora,
      documents: [],
      steps: [],
      history: [],
    });
    this.porIdempotency.set(idempotencyKey, contractId);
    return { contractId, status: SGC_CREATE_STATUS.CREATED };
  }

  async actualizarExpediente(contractId: string, input: SgcActualizarExpedienteInput): Promise<void> {
    const exp = await this.consultarExpediente(contractId);
    if (input.name !== undefined) exp.name = input.name;
    if (input.counterpartyLegalName !== undefined) exp.counterpartyName = input.counterpartyLegalName;
    if (input.counterpartyTaxIdentifier !== undefined) exp.counterpartyTaxIdentifier = input.counterpartyTaxIdentifier;
    exp.updatedAt = new Date().toISOString();
  }

  async consultarExpediente(contractId: string): Promise<SgcExpedienteDetalle> {
    const exp = this.expedientes.get(contractId);
    if (!exp) throw new SgcApiError(`Expediente no encontrado: ${contractId}`, 404);
    return exp;
  }

  async listarExpedientes(filtros: SgcListarFiltros): Promise<SgcPaginaExpedientes> {
    const items = [...this.expedientes.values()].filter((e) => !filtros.stage || e.stage === filtros.stage);
    return {
      items,
      page: filtros.page ?? 1,
      pageSize: filtros.pageSize ?? items.length,
      total: items.length,
    };
  }

  async reservarSubida(contractId: string, input: SgcReservarSubidaInput): Promise<SgcReservarSubidaResult> {
    const exp = this.expedientes.get(contractId);
    if (!exp) throw new SgcApiError(`Expediente no encontrado: ${contractId}`, 404);

    const documentId = input.documentId ?? this.nuevoId();
    const versionId = this.nuevoId();
    let doc = this.documentos.get(documentId);
    if (!doc) {
      doc = {
        documentId,
        contractId,
        category: input.category,
        title: input.title,
        fileName: input.fileName,
        currentVersionId: null,
        versions: [],
      };
      this.documentos.set(documentId, doc);
      exp.documents.push({ documentId, category: input.category, title: input.title, currentVersionId: null });
    }

    const versionNumber = doc.versions.length + 1;
    doc.versions = doc.versions.map((v) => ({ ...v, isCurrent: false }));
    doc.currentVersionId = versionId;
    doc.fileName = input.fileName;
    doc.versions.unshift({
      versionId,
      versionNumber,
      isCurrent: true,
      status: SGC_VERSION_STATUS.AVAILABLE,
      fileName: input.fileName,
      checksumSha256: input.checksumSha256,
      createdAt: new Date().toISOString(),
      approvalMarkKind: null,
      rejectionReason: null,
      sizeBytes: input.sizeBytes,
    });

    const resumen = exp.documents.find((d) => d.documentId === documentId);
    if (resumen) resumen.currentVersionId = versionId;

    return {
      uploadUrl: `${MOCK_BASE_URL}/upload/${versionId}`,
      headers: {
        "content-type": input.declaredMimeType,
        "x-amz-meta-checksum-sha256": input.checksumSha256,
      },
      documentId,
      versionId,
      versionNumber,
      expiresInSeconds: MOCK_EXPIRES_UPLOAD_SECONDS,
    };
  }

  async transferirArchivo(): Promise<void> {
    return;
  }

  async confirmarSubida(versionId: string): Promise<SgcConfirmarSubidaResult> {
    const doc = [...this.documentos.values()].find((d) => d.versions.some((v) => v.versionId === versionId));
    if (!doc) throw new SgcApiError(`Version no encontrada: ${versionId}`, 404);
    return { outcome: SGC_APPROVAL_RESULT.ACCEPTED, previewStatus: SGC_VERSION_STATUS.AVAILABLE };
  }

  async consultarDocumento(documentId: string): Promise<SgcDocumentoDetalle> {
    const doc = this.documentos.get(documentId);
    if (!doc) throw new SgcApiError(`Documento no encontrado: ${documentId}`, 404);
    return {
      documentId: doc.documentId,
      contractId: doc.contractId,
      category: doc.category,
      title: doc.title,
      currentVersionId: doc.currentVersionId,
      versions: doc.versions,
    };
  }

  async resolverVersion(versionId: string): Promise<SgcVersionResuelta> {
    for (const doc of this.documentos.values()) {
      const version = doc.versions.find((v) => v.versionId === versionId);
      if (version) {
        return {
          versionId,
          documentId: doc.documentId,
          contractId: doc.contractId,
          category: doc.category,
          versionNumber: version.versionNumber,
          status: version.status,
          fileName: version.fileName,
          checksumSha256: version.checksumSha256,
          createdAt: version.createdAt,
        };
      }
    }
    throw new SgcApiError(`Version no encontrada: ${versionId}`, 404);
  }

  async obtenerUrlDescarga(versionId: string): Promise<SgcUrlDescarga> {
    await this.resolverVersion(versionId);
    return {
      url: `${MOCK_BASE_URL}/download/${versionId}`,
      expiresInSeconds: MOCK_EXPIRES_DOWNLOAD_SECONDS,
    };
  }
}
