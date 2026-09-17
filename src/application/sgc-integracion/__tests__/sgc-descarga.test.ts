import { describe, it, expect, vi } from "vitest";
import { SgcIntegracionApplicationService } from "../sgc-integracion-service";
import type { SgcIntegracionConfig } from "../sgc-integracion-service";
import type { ISgcRepository } from "@/domain/ports/sgc-repository";
import type { ISgcClient } from "@/domain/ports/sgc-client";
import type { IDocumentoOrigen } from "@/domain/ports/documento-origen";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { SgcDocumentoResumen, SgcExpedienteDetalle, SgcExpedienteEntity } from "@/domain/models/sgc";
import {
  SGC_APPROVAL_RESULT,
  SGC_DOCUMENT_CATEGORIES,
  SGC_ESTADO_ENVIO,
  SGC_LIFECYCLE_STATUSES,
  SGC_STAGES,
  SGC_SUBSANACION_MOTIVO,
} from "@/lib/shared/constants";

const CONFIG: SgcIntegracionConfig = { enabled: true, areaCode: "EVENTOS", contractTypeCode: "AUSPICIO" };

function expediente(): SgcExpedienteEntity {
  return {
    id: "exp-1",
    solicitudId: "sol-1",
    code: "STAND-1",
    contractId: "contract-1",
    estadoEnvio: SGC_ESTADO_ENVIO.CREADO,
    stage: null,
    lifecycleStatus: null,
    version: 1,
    areaCode: "EVENTOS",
    contractTypeCode: "AUSPICIO",
    lastSyncedAt: null,
    lastError: null,
  };
}

function expedienteDetalle(documentos: SgcDocumentoResumen[]): SgcExpedienteDetalle {
  return {
    contractId: "contract-1",
    code: "STAND-1",
    name: "x",
    stage: SGC_STAGES.VALIDITY,
    lifecycleStatus: SGC_LIFECYCLE_STATUSES.ACTIVE,
    areaName: null,
    contractTypeName: null,
    counterpartyName: null,
    counterpartyEmail: null,
    counterpartyTaxIdentifier: null,
    currency: null,
    totalMinorUnits: null,
    startDate: null,
    endDate: null,
    version: 1,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    documents: documentos,
    steps: [],
    history: [],
  };
}

function sgcRepoMock(): ISgcRepository {
  return {
    findExpedientePorSolicitud: vi.fn().mockResolvedValue(expediente()),
    findExpedientePorContractId: vi.fn().mockResolvedValue(expediente()),
    listarConContractId: vi.fn().mockResolvedValue([expediente()]),
    crearExpediente: vi.fn().mockResolvedValue(expediente()),
    actualizarExpediente: vi.fn().mockResolvedValue(expediente()),
    crearDocumento: vi.fn(),
    actualizarDocumento: vi.fn().mockResolvedValue(undefined),
  };
}

function clientMock(documentos: SgcDocumentoResumen[]): ISgcClient {
  return {
    crearExpediente: vi.fn(),
    actualizarExpediente: vi.fn().mockResolvedValue(undefined),
    consultarExpediente: vi.fn().mockResolvedValue(expedienteDetalle(documentos)),
    listarExpedientes: vi.fn(),
    reservarSubida: vi.fn().mockResolvedValue({
      uploadUrl: "https://sgc/upload/1",
      headers: {},
      documentId: "doc-1",
      versionId: "version-2",
      versionNumber: 2,
      expiresInSeconds: 300,
    }),
    transferirArchivo: vi.fn().mockResolvedValue(undefined),
    confirmarSubida: vi.fn().mockResolvedValue({ outcome: SGC_APPROVAL_RESULT.ACCEPTED }),
    consultarDocumento: vi.fn(),
    resolverVersion: vi.fn(),
    obtenerUrlDescarga: vi.fn().mockResolvedValue({ url: "https://sgc/download/1", expiresInSeconds: 60 }),
  };
}

function documentoOrigenMock(): IDocumentoOrigen {
  return {
    leer: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), mimeType: "application/pdf", fileName: "corregido.pdf" }),
  };
}

function build(repo: ISgcRepository, client: ISgcClient, origen: IDocumentoOrigen, config: SgcIntegracionConfig = CONFIG) {
  return new SgcIntegracionApplicationService(
    {} as ISolicitudesRepository,
    repo,
    client,
    origen,
    config,
  );
}

describe("SgcIntegracionApplicationService.obtenerDescargaContrato", () => {
  it("deberia devolver el enlace de la version vigente del contrato", async () => {
    const client = clientMock([
      { documentId: "doc-1", category: SGC_DOCUMENT_CATEGORIES.CONTRACT, title: "Contrato", currentVersionId: "version-1" },
    ]);
    const svc = build(sgcRepoMock(), client, documentoOrigenMock());

    const enlace = await svc.obtenerDescargaContrato("sol-1");

    expect(client.obtenerUrlDescarga).toHaveBeenCalledWith("version-1");
    expect(enlace?.url).toBe("https://sgc/download/1");
  });

  it("deberia devolver null si no hay contrato", async () => {
    const client = clientMock([
      { documentId: "doc-2", category: SGC_DOCUMENT_CATEGORIES.ANNEX, title: "Anexo", currentVersionId: "version-9" },
    ]);
    const svc = build(sgcRepoMock(), client, documentoOrigenMock());

    expect(await svc.obtenerDescargaContrato("sol-1")).toBeNull();
    expect(client.obtenerUrlDescarga).not.toHaveBeenCalled();
  });

  it("deberia devolver null si la integracion esta deshabilitada", async () => {
    const client = clientMock([]);
    const svc = build(sgcRepoMock(), client, documentoOrigenMock(), { ...CONFIG, enabled: false });

    expect(await svc.obtenerDescargaContrato("sol-1")).toBeNull();
    expect(client.consultarExpediente).not.toHaveBeenCalled();
  });
});

describe("SgcIntegracionApplicationService.subsanarContrato", () => {
  it("deberia empujar una version corregida sobre el mismo documentId", async () => {
    const client = clientMock([]);
    const svc = build(sgcRepoMock(), client, documentoOrigenMock());

    await svc.subsanarContrato("sol-1", { url: "/uploads/corregido.pdf", title: "Contrato corregido", documentId: "doc-1" });

    expect(client.reservarSubida).toHaveBeenCalledWith(
      "contract-1",
      expect.objectContaining({ documentId: "doc-1", replacementReason: SGC_SUBSANACION_MOTIVO, category: SGC_DOCUMENT_CATEGORIES.CONTRACT }),
    );
  });
});
