import { describe, it, expect, vi } from "vitest";
import { SgcIntegracionApplicationService } from "../sgc-integracion-service";
import type { SgcIntegracionConfig } from "../sgc-integracion-service";
import type { ISgcRepository } from "@/domain/ports/sgc-repository";
import type { ISgcClient } from "@/domain/ports/sgc-client";
import type { IDocumentoOrigen } from "@/domain/ports/documento-origen";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { SgcExpedienteEntity } from "@/domain/models/sgc";
import type { SolicitudRow } from "@/domain/models/entities";
import { SGC_CREATE_STATUS, SGC_ESTADO_ENVIO, SGC_IDEMPOTENCY_PREFIX } from "@/lib/shared/constants";

const CONFIG: SgcIntegracionConfig = { enabled: true, areaCode: "EVENTOS", contractTypeCode: "AUSPICIO" };

function detalle(overrides: Partial<SolicitudRow> = {}): SolicitudRow {
  return {
    id: "sol-1",
    gessStandId: "g1",
    standCode: "STAND-1",
    standCodes: ["STAND-1"],
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
    ...overrides,
  };
}

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

function sgcRepoMock(existente: SgcExpedienteEntity | null): ISgcRepository {
  return {
    findExpedientePorSolicitud: vi.fn().mockResolvedValue(existente),
    findExpedientePorContractId: vi.fn().mockResolvedValue(null),
    listarConContractId: vi.fn().mockResolvedValue([]),
    listarConEstadoEnvio: vi.fn().mockResolvedValue([]),
    crearExpediente: vi.fn().mockResolvedValue(expediente()),
    actualizarExpediente: vi.fn().mockImplementation((_id: string, data: Partial<SgcExpedienteEntity>) =>
      Promise.resolve(expediente(data)),
    ),
    crearDocumento: vi.fn(),
    actualizarDocumento: vi.fn().mockResolvedValue(undefined),
  };
}

function clientMock(): ISgcClient {
  return {
    crearExpediente: vi.fn().mockResolvedValue({ contractId: "contract-1", status: SGC_CREATE_STATUS.CREATED }),
    actualizarExpediente: vi.fn().mockResolvedValue(undefined),
    consultarExpediente: vi.fn(),
    listarExpedientes: vi.fn(),
    reservarSubida: vi.fn(),
    transferirArchivo: vi.fn().mockResolvedValue(undefined),
    confirmarSubida: vi.fn(),
    consultarDocumento: vi.fn(),
    resolverVersion: vi.fn(),
    obtenerUrlDescarga: vi.fn(),
    reabrirExpediente: vi.fn(),
    listarTiposContrato: vi.fn(),
    listarTemplates: vi.fn(),
    obtenerTemplate: vi.fn(),
  };
}

function solicitudRepoMock(row: SolicitudRow | null): ISolicitudesRepository {
  return {
    listar: vi.fn(),
    detalle: vi.fn().mockResolvedValue(row),
    crearOActualizarRevision: vi.fn(),
    crearRevisionInicial: vi.fn(),
    crearSolicitud: vi.fn(),
    crearAlertaReserva: vi.fn(),
    crearReevaluacion: vi.fn(),
    tieneReevaluacionPendiente: vi.fn(),
    atenderReevaluacionAprobacion: vi.fn(),
    atenderReevaluacionRechazo: vi.fn(),
    darDeBajaSolicitud: vi.fn(),
    marcarOrdenPago: vi.fn(),
    obtenerHistorial: vi.fn(),
    crearDocumentoAdjunto: vi.fn(),
    findDocumento: vi.fn(),
    eliminarDocumento: vi.fn(),
    crearAlertaRevision: vi.fn(),
    crearAlertaRol: vi.fn(),
  };
}

function documentoOrigenMock(): IDocumentoOrigen {
  return { leer: vi.fn() };
}

describe("SgcIntegracionApplicationService.crearExpedienteDesdeSolicitud", () => {
  it("deberia no hacer nada cuando la integracion esta deshabilitada", async () => {
    const repo = sgcRepoMock(null);
    const client = clientMock();
    const svc = new SgcIntegracionApplicationService(solicitudRepoMock(detalle()), repo, client, documentoOrigenMock(), { ...CONFIG, enabled: false });

    const result = await svc.crearExpedienteDesdeSolicitud("sol-1");

    expect(result).toBeNull();
    expect(repo.findExpedientePorSolicitud).not.toHaveBeenCalled();
    expect(client.crearExpediente).not.toHaveBeenCalled();
  });

  it("deberia crear el expediente y persistir la correlacion con contractId", async () => {
    const repo = sgcRepoMock(null);
    const client = clientMock();
    const svc = new SgcIntegracionApplicationService(solicitudRepoMock(detalle()), repo, client, documentoOrigenMock(), CONFIG);

    const result = await svc.crearExpedienteDesdeSolicitud("sol-1");

    expect(client.crearExpediente).toHaveBeenCalledWith(
      expect.objectContaining({ code: "STAND-1" }),
      `${SGC_IDEMPOTENCY_PREFIX}/sol-1`,
    );
    expect(repo.actualizarExpediente).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({ contractId: "contract-1", estadoEnvio: SGC_ESTADO_ENVIO.CREADO }),
    );
    expect(result?.contractId).toBe("contract-1");
  });

  it("deberia ser idempotente si el expediente ya fue creado", async () => {
    const repo = sgcRepoMock(expediente({ estadoEnvio: SGC_ESTADO_ENVIO.CREADO, contractId: "contract-1" }));
    const client = clientMock();
    const svc = new SgcIntegracionApplicationService(solicitudRepoMock(detalle()), repo, client, documentoOrigenMock(), CONFIG);

    const result = await svc.crearExpedienteDesdeSolicitud("sol-1");

    expect(client.crearExpediente).not.toHaveBeenCalled();
    expect(result?.contractId).toBe("contract-1");
  });

  it("deberia registrar el error y no lanzar cuando el SGC falla", async () => {
    const repo = sgcRepoMock(null);
    const client = clientMock();
    vi.mocked(client.crearExpediente).mockRejectedValue(new Error("SGC 503"));
    const svc = new SgcIntegracionApplicationService(solicitudRepoMock(detalle()), repo, client, documentoOrigenMock(), CONFIG);

    const result = await svc.crearExpedienteDesdeSolicitud("sol-1");

    expect(result).toBeNull();
    expect(repo.actualizarExpediente).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({ estadoEnvio: SGC_ESTADO_ENVIO.ERROR, lastError: "SGC 503" }),
    );
  });

  it("deberia no llamar al SGC si no existe la solicitud", async () => {
    const repo = sgcRepoMock(null);
    const client = clientMock();
    const svc = new SgcIntegracionApplicationService(solicitudRepoMock(null), repo, client, documentoOrigenMock(), CONFIG);

    const result = await svc.crearExpedienteDesdeSolicitud("sol-1");

    expect(result).toBeNull();
    expect(client.crearExpediente).not.toHaveBeenCalled();
  });
});
