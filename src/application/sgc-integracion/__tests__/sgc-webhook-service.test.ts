import { describe, it, expect, vi } from "vitest";
import { SgcWebhookApplicationService } from "../sgc-webhook-service";
import { enviarEmailPlantilla } from "@/lib/server/email";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/email", () => ({ enviarEmailPlantilla: vi.fn().mockResolvedValue(true) }));
import type { SgcIntegracionConfig } from "../sgc-integracion-service";
import type { ISgcWebhookRepository } from "@/domain/ports/sgc-webhook-repository";
import type { ISgcRepository } from "@/domain/ports/sgc-repository";
import type {
  SgcDocumentoEntity,
  SgcExpedienteEntity,
  SgcWebhookEventoEntity,
  SgcWebhookPayload,
} from "@/domain/models/sgc";
import {
  SGC_DOCUMENT_CATEGORIES,
  SGC_DOCUMENTO_ESTADO,
  SGC_ESTADO_ENVIO,
  SGC_EVENT_TYPES,
  SGC_LIFECYCLE_STATUSES,
  SGC_STAGES,
} from "@/lib/shared/constants";
const CONFIG: SgcIntegracionConfig = {
  enabled: true,
  areaCode: "EVENTOS",
  contractTypeCode: "AUSPICIO",
};
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
    subsanacionMotivo: null,
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
function payload(
  overrides: Partial<SgcWebhookPayload> = {},
): SgcWebhookPayload {
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
function webhookRepoMock(
  existente: SgcWebhookEventoEntity | null = null,
): ISgcWebhookRepository {
  return {
    findEvento: vi.fn().mockResolvedValue(existente),
    findEventoPorDelivery: vi.fn().mockResolvedValue(null),
    registrarEvento: vi
      .fn()
      .mockResolvedValue({
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
    findExpedientePorSolicitud: vi
      .fn()
      .mockResolvedValue(existe ? expediente() : null),
    findExpedientePorContractId: vi
      .fn()
      .mockResolvedValue(existe ? expediente() : null),
    listarConContractId: vi
      .fn()
      .mockResolvedValue(existe ? [expediente()] : []),
    listarConEstadoEnvio: vi.fn().mockResolvedValue([]),
    crearExpediente: vi.fn().mockResolvedValue(expediente()),
    actualizarExpediente: vi.fn().mockResolvedValue(expediente()),
    crearDocumento: vi.fn().mockResolvedValue(documento()),
    actualizarDocumento: vi.fn(),
    crearSubsanacion: vi.fn(),
    listarSubsanaciones: vi.fn().mockResolvedValue([]),
    marcarSubsanacionReenviada: vi.fn().mockResolvedValue(undefined),
  };
}
function build(
  repo: ISgcWebhookRepository,
  sgcRepo: ISgcRepository,
  config: SgcIntegracionConfig = CONFIG,
  solicitudes?: ISolicitudesRepository,
  auth?: IAuthRepository,
) {
  return new SgcWebhookApplicationService(repo, sgcRepo, config, solicitudes, auth);
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

  it("no reprocesa una entrega repetida (dedup por x-sgc-delivery)", async () => {
    const repo = webhookRepoMock();
    vi.mocked(repo.findEventoPorDelivery).mockResolvedValue({
      id: "w2",
      eventId: "evt-0",
      eventType: "workflow.advanced",
      resourceId: "contract-1",
      resourceCode: "STAND-1",
      procesadoAt: new Date(),
      error: null,
    });
    const sgcRepo = sgcRepoMock();
    const r = await build(repo, sgcRepo).procesar(payload(), "del-1");
    expect(r.duplicado).toBe(true);
    expect(repo.registrarEvento).not.toHaveBeenCalled();
  });
  it("deberia marcar Vigente cuando la aprobacion finaliza activa", async () => {
    const repo = webhookRepoMock();
    const sgcRepo = sgcRepoMock();
    const svc = build(repo, sgcRepo);
    await svc.procesar(
      payload({
        eventType: SGC_EVENT_TYPES.WORKFLOW_APPROVED,
        data: { finalization: "active" },
      }),
    );
    expect(sgcRepo.actualizarExpediente).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({
        lifecycleStatus: SGC_LIFECYCLE_STATUSES.ACTIVE,
      }),
    );
  });
  it("deberia notificar al cliente en su idioma cuando el SGC aprueba (activo)", async () => {
    const repo = webhookRepoMock();
    const sgcRepo = sgcRepoMock();
    const solicitudes = {
      detalle: vi.fn().mockResolvedValue({
        id: "sol-1",
        standCode: "BLOQUE-01",
        empresa: "Minera Cordillera S.A.C.",
        email: "cliente@minera.pe",
        userId: "user-1",
        estado: "aprobado",
        revisiones: [{ area: "asociado", estado: "aprobado", comentario: null }],
      }),
      findNombreUsuario: vi.fn().mockResolvedValue("Jorge Quispe"),
      marcarOrdenPago: vi.fn().mockResolvedValue(undefined),
    } as unknown as ISolicitudesRepository;
    const auth = { findPerfilByEmail: vi.fn().mockResolvedValue({ idioma: "en" }) } as unknown as IAuthRepository;
    const svc = build(repo, sgcRepo, CONFIG, solicitudes, auth);

    await svc.procesar(
      payload({ eventType: SGC_EVENT_TYPES.WORKFLOW_APPROVED, data: { finalization: "active" } }),
    );

    expect(vi.mocked(enviarEmailPlantilla)).toHaveBeenCalledWith(
      expect.objectContaining({ to: "cliente@minera.pe", plantilla: "revision-resultado", idioma: "en" }),
    );
  });
  it("deberia generar la orden de pago automaticamente cuando el SGC aprueba (activo)", async () => {
    const repo = webhookRepoMock();
    const sgcRepo = sgcRepoMock();
    const solicitudes = {
      detalle: vi.fn().mockResolvedValue({ id: "sol-1", estado: "aprobado" }),
      marcarOrdenPago: vi.fn().mockResolvedValue(undefined),
    } as unknown as ISolicitudesRepository;
    const svc = build(repo, sgcRepo, CONFIG, solicitudes);

    await svc.procesar(
      payload({ eventType: SGC_EVENT_TYPES.WORKFLOW_APPROVED, data: { finalization: "active" } }),
    );

    expect(vi.mocked(solicitudes.marcarOrdenPago)).toHaveBeenCalledWith("sol-1");
  });
  it("deberia no regenerar la orden de pago si la solicitud ya esta pendiente de pago o pagada", async () => {
    const repo = webhookRepoMock();
    const sgcRepo = sgcRepoMock();
    const solicitudes = {
      detalle: vi.fn().mockResolvedValue({ id: "sol-1", estado: "pendiente_pago" }),
      marcarOrdenPago: vi.fn().mockResolvedValue(undefined),
    } as unknown as ISolicitudesRepository;
    const svc = build(repo, sgcRepo, CONFIG, solicitudes);

    await svc.procesar(
      payload({ eventType: SGC_EVENT_TYPES.WORKFLOW_APPROVED, data: { finalization: "active" } }),
    );

    expect(vi.mocked(solicitudes.marcarOrdenPago)).not.toHaveBeenCalled();
  });
  it("deberia generar la orden de pago tambien cuando la aprobacion cierra sin activar el contrato", async () => {
    const repo = webhookRepoMock();
    const sgcRepo = sgcRepoMock();
    const solicitudes = {
      detalle: vi.fn().mockResolvedValue({ id: "sol-1", estado: "en_proceso" }),
      marcarOrdenPago: vi.fn().mockResolvedValue(undefined),
    } as unknown as ISolicitudesRepository;
    const svc = build(repo, sgcRepo, CONFIG, solicitudes);

    await svc.procesar(
      payload({ eventType: SGC_EVENT_TYPES.WORKFLOW_APPROVED, data: { finalization: "finalized" } }),
    );

    expect(vi.mocked(solicitudes.marcarOrdenPago)).toHaveBeenCalledWith("sol-1");
  });
  it("deberia no repetir la orden de pago si el expediente ya estaba Vigente", async () => {
    const repo = webhookRepoMock();
    const sgcRepo = sgcRepoMock();
    vi.mocked(sgcRepo.findExpedientePorContractId).mockResolvedValue({
      ...expediente(),
      lifecycleStatus: SGC_LIFECYCLE_STATUSES.ACTIVE,
    });
    const solicitudes = {
      detalle: vi.fn().mockResolvedValue({ id: "sol-1", estado: "aprobado" }),
      marcarOrdenPago: vi.fn().mockResolvedValue(undefined),
    } as unknown as ISolicitudesRepository;
    const svc = build(repo, sgcRepo, CONFIG, solicitudes);

    await svc.procesar(
      payload({ eventType: SGC_EVENT_TYPES.WORKFLOW_APPROVED, data: { finalization: "active" } }),
    );

    expect(vi.mocked(solicitudes.marcarOrdenPago)).not.toHaveBeenCalled();
  });
  it("deberia seguir procesando el webhook si la orden de pago falla (best-effort)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const repo = webhookRepoMock();
    const sgcRepo = sgcRepoMock();
    const solicitudes = {
      detalle: vi.fn().mockResolvedValue({ id: "sol-1", estado: "aprobado" }),
      marcarOrdenPago: vi.fn().mockRejectedValue(new Error("db caida")),
    } as unknown as ISolicitudesRepository;
    const svc = build(repo, sgcRepo, CONFIG, solicitudes);

    const r = await svc.procesar(
      payload({ eventType: SGC_EVENT_TYPES.WORKFLOW_APPROVED, data: { finalization: "active" } }),
    );

    expect(r.recibido).toBe(true);
    expect(repo.marcarProcesado).toHaveBeenCalledWith("evt-1", null);
    spy.mockRestore();
  });
  it("deberia marcar observado y guardar datos cuando la devolucion exige cambio documental", async () => {
    const repo = webhookRepoMock();
    const sgcRepo = sgcRepoMock();
    const svc = build(repo, sgcRepo);

    await svc.procesar(
      payload({
        eventType: SGC_EVENT_TYPES.WORKFLOW_RETURNED,
        data: {
          reason: "Falta el anexo de garantias.",
          requiresDocumentChange: true,
          destinationStepId: null,
          strategy: "return-to-sender",
          round: 1,
        },
      }),
    );

    expect(sgcRepo.actualizarExpediente).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({
        lifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED,
        devolucionRequiereCambio: true,
        devolucionMotivo: "Falta el anexo de garantias.",
        devolucionDestinoStepId: null,
        devolucionEstrategia: "return-to-sender",
      }),
    );
  });
  it("deberia NO marcar observado cuando la devolucion es validacion interna (sin cambio documental)", async () => {
    const repo = webhookRepoMock();
    const sgcRepo = sgcRepoMock();
    const svc = build(repo, sgcRepo);

    await svc.procesar(
      payload({
        eventType: SGC_EVENT_TYPES.WORKFLOW_RETURNED,
        data: {
          reason: "Validar monto con el area.",
          requiresDocumentChange: false,
          destinationStepId: "step-9",
          strategy: "restart-forward",
          round: 1,
        },
      }),
    );

    const cambios = vi.mocked(sgcRepo.actualizarExpediente).mock.calls[0]?.[1];
    expect(cambios?.lifecycleStatus).toBeUndefined();
    expect(cambios).toEqual(
      expect.objectContaining({
        devolucionRequiereCambio: false,
        devolucionMotivo: "Validar monto con el area.",
        devolucionDestinoStepId: "step-9",
        devolucionEstrategia: "restart-forward",
      }),
    );
  });
  it("deberia tratar como devolucion con cambio cuando el webhook no trae requiresDocumentChange (legado)", async () => {
    const repo = webhookRepoMock();
    const sgcRepo = sgcRepoMock();
    const svc = build(repo, sgcRepo);

    await svc.procesar(
      payload({
        eventType: SGC_EVENT_TYPES.WORKFLOW_RETURNED,
        data: { reason: "Devolucion sin el campo nuevo", round: 1 },
      }),
    );

    expect(sgcRepo.actualizarExpediente).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({
        lifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED,
        devolucionRequiereCambio: true,
      }),
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
