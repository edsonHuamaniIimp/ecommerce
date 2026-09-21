import { describe, it, expect, vi } from "vitest";
import { SgcOutboxApplicationService } from "../sgc-outbox-service";
import type { SgcIntegracionApplicationService, SgcIntegracionConfig } from "../sgc-integracion-service";
import type { ISgcOutboxRepository } from "@/domain/ports/sgc-outbox-repository";
import type { SgcOutboxEntity } from "@/domain/models/sgc";
import { SGC_OUTBOX_ESTADO, SGC_OUTBOX_OPERACION } from "@/lib/shared/constants";

const CONFIG: SgcIntegracionConfig = { enabled: true, areaCode: "EVENTOS", contractTypeCode: "AUSPICIO" };

function item(overrides: Partial<SgcOutboxEntity> = {}): SgcOutboxEntity {
  return {
    id: "o1",
    operacion: SGC_OUTBOX_OPERACION.SUBIR_CONTRATO,
    idempotencyKey: null,
    payload: { solicitudId: "sol-1" },
    estado: SGC_OUTBOX_ESTADO.PENDIENTE,
    intentos: 0,
    ultimoError: null,
    programadoAt: new Date("2026-09-15T00:00:00.000Z"),
    ...overrides,
  };
}

function outboxRepo(items: SgcOutboxEntity[]): ISgcOutboxRepository {
  return {
    encolar: vi.fn(),
    listarPendientes: vi.fn().mockResolvedValue(items),
    marcarEnviado: vi.fn().mockResolvedValue(undefined),
    marcarError: vi.fn().mockResolvedValue(undefined),
  } as unknown as ISgcOutboxRepository;
}

function sgcMock(overrides: Partial<Record<keyof SgcIntegracionApplicationService, unknown>> = {}): SgcIntegracionApplicationService {
  return {
    subirContratoDeSolicitud: vi.fn().mockResolvedValue({ documentId: "d1" }),
    subirAnexosDeSolicitud: vi.fn().mockResolvedValue([]),
    subsanarContrato: vi.fn().mockResolvedValue({ documentId: "d1" }),
    ...overrides,
  } as unknown as SgcIntegracionApplicationService;
}

describe("SgcOutboxApplicationService.despachar", () => {
  it("deberia marcar como enviado cuando la operacion tiene exito", async () => {
    const repo = outboxRepo([item()]);
    const svc = new SgcOutboxApplicationService(repo, sgcMock(), CONFIG);

    const r = await svc.despachar();

    expect(r).toEqual({ enviados: 1, fallidos: 0 });
    expect(repo.marcarEnviado).toHaveBeenCalledWith("o1");
    expect(repo.marcarError).not.toHaveBeenCalled();
  });

  it("deberia reprogramar con backoff cuando la operacion falla", async () => {
    const repo = outboxRepo([item({ intentos: 1 })]);
    const sgc = sgcMock({ subirContratoDeSolicitud: vi.fn().mockResolvedValue(null) });
    const svc = new SgcOutboxApplicationService(repo, sgc, CONFIG);

    const r = await svc.despachar();

    expect(r).toEqual({ enviados: 0, fallidos: 1 });
    expect(repo.marcarError).toHaveBeenCalledWith("o1", expect.any(String), expect.any(Date), 2);
    const programadoAt = vi.mocked(repo.marcarError).mock.calls[0]?.[2];
    expect(programadoAt).toBeInstanceOf(Date);
    expect((programadoAt as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it("deberia ejecutar la subsanacion con su payload", async () => {
    const repo = outboxRepo([
      item({ operacion: SGC_OUTBOX_OPERACION.SUBSANAR, payload: { solicitudId: "sol-1", documentId: "d1", url: "/uploads/c.pdf", title: "Corregido" } }),
    ]);
    const sgc = sgcMock();
    const svc = new SgcOutboxApplicationService(repo, sgc, CONFIG);

    await svc.despachar();

    expect(sgc.subsanarContrato).toHaveBeenCalledWith("sol-1", { documentId: "d1", url: "/uploads/c.pdf", title: "Corregido" });
  });

  it("deberia no hacer nada si la integracion esta deshabilitada", async () => {
    const repo = outboxRepo([item()]);
    const svc = new SgcOutboxApplicationService(repo, sgcMock(), { ...CONFIG, enabled: false });

    const r = await svc.despachar();

    expect(r).toEqual({ enviados: 0, fallidos: 0 });
    expect(repo.listarPendientes).not.toHaveBeenCalled();
  });
});
