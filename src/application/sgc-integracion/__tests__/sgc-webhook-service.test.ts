import { describe, it, expect, vi } from "vitest";
import { SgcWebhookApplicationService } from "../sgc-webhook-service";
import type { SgcIntegracionConfig } from "../sgc-integracion-service";
import type { ISgcWebhookRepository } from "@/domain/ports/sgc-webhook-repository";
import type { ISgcRepository } from "@/domain/ports/sgc-repository";
import type { SgcDocumentoEntity, SgcExpedienteEntity, SgcWebhookEventoEntity, SgcWebhookPayload } from "@/domain/models/sgc";
import {
  SGC_DOCUMENT_CATEGORIES,
  SGC_DOCUMENTO_ESTADO,
  SGC_ESTADO_ENVIO,
  SGC_EVENT_TYPES,
  SGC_LIFECYCLE_STATUSES,
  SGC_STAGES,
} from "@/lib/shared/constants";

const CONFIG: SgcIntegracionConfig = { enabled: true, areaCode: "EVENTOS", contractTypeCode: "AUSPICIO" };

function expediente(): SgcExpedienteEntity {
  return {
    id: "exp-1",
    solicitudId: "sol-1",
    code: "STAND-1",
    contractId: "contract-1",
    estadoEnvio: SGC_ESTADO_ENVIO.CREADO,
    stage: SGC_STAGES.DRAFTING,
    lifecycleStatus: null,
    version: 1,
    areaCode: "EVENTOS",
    contractTypeCode: "AUSPICIO",
    lastSyncedAt: null,
    lastError: null,
  };
}

function documento(): SgcDocumentoEntity {
  return {
    id: "doc-1",
    sgcExpedienteId: "exp-1",
    documentId: "sgc-doc-1",
    currentVersionId: null,
    category: SGC_DOCUMENT_CATEGORIES.CONTRACT,
    title: "Contrato",
    fileName: "contrato.pdf",
    checksumSha256: null,
    sizeBytes: null,
    estado: SGC_DOCUMENTO_ESTADO.RESERVADO,
  };
}

function payload(overrides: Partial<SgcWebhookPayload> = {}): SgcWebhookPayload {
  return {
    apiVersion: "2026-09-01",
    eventId: "evt-1",
    eventType: SGC_EVENT_TYPES.WORKFLOW_ADVANCED,
    createdAt: "2026-09-15T14:32:00.000Z",
    resource: { id: "contract-1", type: "contract", code: "STAND-1" },
    data: { from: "internal-review", to: SGC_STAGES.APPROVAL, round: 1 },
    ...overrides,
  };
}

function webhookRepoMock(existente: SgcWebhookEventoEntity | null = null): ISgcWebhookRepository {
  return {
    findEvento: vi.fn().mockResolvedValue(existente),
    registrarEvento: vi.fn().mockResolvedValue({
      id: "w1",
      eventId: "evt-1",
      eventType: "workflow.advanced",
      resourceId: "contract-1",
      resourceCode: "STAND-1",
      procesadoAt: null,
      error: null,
    }),
    marcarProcesado: vi.fn().mockResolvedValue(undefined),
  };
}

function sgcRepoMock(existe = true): ISgcRepository {
  return {
    findExpedientePorSolicitud: vi.fn().mockResolvedValue(existe ? expediente() : null),
    findExpedientePorContractId: vi.fn().mockResolvedValue(existe ? expediente() : null),
    listarConContractId: vi.fn().mockResolvedValue(existe ? [expediente()] : []),
    listarConEstadoEnvio: vi.fn().mockResolvedValue([]),
    crearExpediente: vi.fn().mockResolvedValue(expediente()),
    actualizarExpediente: vi.fn().mockResolvedValue(expediente()),
    crearDocumento: vi.fn().mockResolvedValue(documento()),
    actualizarDocumento: vi.fn().mockResolvedValue(undefined),
  };
}

function build(repo: ISgcWebhookRepository, sgcRepo: ISgcRepository, config: SgcIntegracionConfig = CONFIG) {
  return new SgcWebhookApplicationService(repo, sgcRepo, config);
}

describe("SgcWebhookApplicationService.procesar", () => {
  it("deberia registrar el evento y actualizar la etapa del expediente", async () => {
    const repo = webhookRepoMock();
    const sgcRepo = sgcRepoMock();
    const svc = build(repo, sgcRepo);

    const r = await svc.procesar(payload());

    expect(repo.registrarEvento).toHaveBeenCalled();
    expect(sgcRepo.actualizarExpediente).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({ stage: SGC_STAGES.APPROVAL }),
    );
    expect(repo.marcarProcesado).toHaveBeenCalledWith("evt-1", null);
    expect(r.duplicado).toBe(false);
  });

  it("deberia ser idempotente por eventId", async () => {
    const existente: SgcWebhookEventoEntity = {
      id: "w1",
      eventId: "evt-1",
      eventType: "workflow.advanced",
      resourceId: "contract-1",
      resourceCode: "STAND-1",
      procesadoAt: new Date(),
      error: null,
    };
    const repo = webhookRepoMock(existente);
    const sgcRepo = sgcRepoMock();
    const svc = build(repo, sgcRepo);

    const r = await svc.procesar(payload());

    expect(r.duplicado).toBe(true);
    expect(repo.registrarEvento).not.toHaveBeenCalled();
    expect(sgcRepo.actualizarExpediente).not.toHaveBeenCalled();
  });

  it("deberia marcar Vigente cuando la aprobacion finaliza activa", async () => {
    const repo = webhookRepoMock();
    const sgcRepo = sgcRepoMock();
    const svc = build(repo, sgcRepo);

    await svc.procesar(payload({ eventType: SGC_EVENT_TYPES.WORKFLOW_APPROVED, data: { finalization: "active" } }));

    expect(sgcRepo.actualizarExpediente).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({ lifecycleStatus: SGC_LIFECYCLE_STATUSES.ACTIVE }),
    );
  });

  it("deberia ignorar un evento sin eventId", async () => {
    const repo = webhookRepoMock();
    const svc = build(repo, sgcRepoMock());

    const r = await svc.procesar(payload({ eventId: "" }));

    expect(r.recibido).toBe(false);
    expect(repo.findEvento).not.toHaveBeenCalled();
  });

  it("deberia no hacer nada si la integracion esta deshabilitada", async () => {
    const repo = webhookRepoMock();
    const svc = build(repo, sgcRepoMock(), { ...CONFIG, enabled: false });

    const r = await svc.procesar(payload());

    expect(r.recibido).toBe(true);
    expect(repo.findEvento).not.toHaveBeenCalled();
  });
});
