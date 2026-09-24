import { describe, it, expect, vi } from "vitest";
import { SgcIntegracionApplicationService } from "../sgc-integracion-service";
import type { ISgcRepository } from "@/domain/ports/sgc-repository";
import type { ISgcClient } from "@/domain/ports/sgc-client";
import type { IDocumentoOrigen } from "@/domain/ports/documento-origen";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { SgcExpedienteDetalle, SgcExpedienteEntity } from "@/domain/models/sgc";
import type { SolicitudRow } from "@/domain/models/entities";
import { SGC_ESTADO_ENVIO, SGC_LIFECYCLE_STATUSES, SGC_STAGES } from "@/lib/shared/constants";

const CONFIG = { enabled: true, areaCode: "EVENTOS", contractTypeCode: "AUSPICIO" };

function expediente(overrides: Partial<SgcExpedienteEntity> = {}): SgcExpedienteEntity {
  return {
    id: "exp-1",
    solicitudId: "sol-1",
    code: "STAND-1",
    contractId: null,
    estadoEnvio: SGC_ESTADO_ENVIO.PENDIENTE,
    stage: null,
    lifecycleStatus: null,
    version: null,
    areaCode: "EVENTOS",
    contractTypeCode: "AUSPICIO",
    lastSyncedAt: null,
    lastError: null,
    ...overrides,
  };
}

function detalleSgc(): SgcExpedienteDetalle {
  return {
    contractId: "c1",
    code: "STAND-1",
    name: "x",
    stage: SGC_STAGES.INTERNAL_REVIEW,
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
    version: 2,
    createdAt: "2026-09-15T00:00:00.000Z",
    updatedAt: "2026-09-15T00:00:00.000Z",
    documents: [],
    steps: [],
    history: [],
  };
}

function solicitudDetalle(): SolicitudRow {
  return {
    id: "sol-2",
    gessStandId: "g1",
    standCode: "STAND-2",
    standCodes: ["STAND-2"],
    tipoStand: null,
    medidas: null,
    empresa: "Expositor S.A.C.",
    email: null,
    userId: null,
    bloqueId: null,
    estado: null,
    estadoSolicitud: "aprobado",
    flgActivo: true,
    documentos: [],
    imagenes: [],
    docsAdjuntosCount: 0,
    clienteDocsAdjuntosCount: 0,
    docsAdminCount: 0,
    docsAdjuntos: [],
    updatedAt: new Date("2026-09-15T00:00:00.000Z"),
    revisiones: [],
    reevaluaciones: [],
    revisionComunicacion: null,
    revisionLegal: null,
    revisionLogistica: null,
    tieneFacturacion: false,
    tipoFacturacion: null,
    facturacionId: null,
    sgcEstadoEnvio: null,
    sgcLifecycleStatus: null,
    sgcStage: null,
    sgcDocumentosEnviados: false,
    sgcEnabled: false,
  };
}

function build(repo: ISgcRepository, client: ISgcClient) {
  const solicitudRepo = { detalle: vi.fn().mockResolvedValue(solicitudDetalle()) } as unknown as ISolicitudesRepository;
  const documentoOrigen = { leer: vi.fn() } as unknown as IDocumentoOrigen;
  return new SgcIntegracionApplicationService(solicitudRepo, repo, client, documentoOrigen, CONFIG);
}

describe("SgcIntegracionApplicationService.sincronizarCron", () => {
  it("deberia reconciliar los creados y reintentar los que quedaron en error", async () => {
    const repo = {
      listarConContractId: vi.fn().mockResolvedValue([expediente({ id: "exp-1", contractId: "c1" })]),
      listarConEstadoEnvio: vi
        .fn()
        .mockResolvedValue([expediente({ id: "exp-2", solicitudId: "sol-2", contractId: null, estadoEnvio: SGC_ESTADO_ENVIO.ERROR })]),
      findExpedientePorSolicitud: vi.fn().mockResolvedValue(null),
      crearExpediente: vi.fn().mockResolvedValue(expediente({ id: "exp-3", estadoEnvio: SGC_ESTADO_ENVIO.PENDIENTE })),
      actualizarExpediente: vi.fn().mockImplementation((id: string, data: Partial<SgcExpedienteEntity>) =>
        Promise.resolve(expediente({ id, ...data })),
      ),
    } as unknown as ISgcRepository;
    const client = {
      consultarExpediente: vi.fn().mockResolvedValue(detalleSgc()),
      crearExpediente: vi.fn().mockResolvedValue({ contractId: "c2", status: "created" }),
    } as unknown as ISgcClient;
    const svc = build(repo, client);

    const resultado = await svc.sincronizarCron();

    expect(resultado.sincronizados).toBe(1);
    expect(resultado.reintentados).toBe(1);
    expect(repo.actualizarExpediente).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({ stage: SGC_STAGES.INTERNAL_REVIEW, lifecycleStatus: SGC_LIFECYCLE_STATUSES.ACTIVE }),
    );
  });

  it("deberia no hacer nada si la integracion esta deshabilitada", async () => {
    const repo = {
      listarConContractId: vi.fn(),
      listarConEstadoEnvio: vi.fn(),
    } as unknown as ISgcRepository;
    const client = {} as unknown as ISgcClient;
    const solicitudRepo = { detalle: vi.fn() } as unknown as ISolicitudesRepository;
    const svc = new SgcIntegracionApplicationService(solicitudRepo, repo, client, { leer: vi.fn() } as unknown as IDocumentoOrigen, {
      ...CONFIG,
      enabled: false,
    });

    const resultado = await svc.sincronizarCron();

    expect(resultado).toEqual({ sincronizados: 0, reintentados: 0 });
    expect(repo.listarConContractId).not.toHaveBeenCalled();
    expect(repo.listarConEstadoEnvio).not.toHaveBeenCalled();
  });
});
