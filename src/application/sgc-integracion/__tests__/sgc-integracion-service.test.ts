import { describe, it, expect, vi } from "vitest";
import { SgcIntegracionApplicationService } from "../sgc-integracion-service";
import type { SgcIntegracionConfig } from "../sgc-integracion-service";
import type { ISgcRepository } from "@/domain/ports/sgc-repository";
import type { ISgcClient } from "@/domain/ports/sgc-client";
import type { IDocumentoOrigen } from "@/domain/ports/documento-origen";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { SgcExpedienteEntity } from "@/domain/models/sgc";
import { SgcApiError } from "@/domain/models/sgc";
import { DomainError } from "@/domain/errors/domain-error";
import { sha256Hex } from "@/lib/shared/utils/sgc";
import type { SolicitudRow } from "@/domain/models/entities";
import {
  API_ERROR_CODES,
  SGC_INTENTO_ORIGENES,
  SGC_INTENTO_RESULTADOS,
  ESTADOS_DOCUMENTO_SOLICITUD,
  ESTADOS_SOLICITUD,
  SGC_CREATE_STATUS,
  SGC_ESTADO_ENVIO,
  SGC_IDEMPOTENCY_PREFIX,
  SGC_LIFECYCLE_STATUSES,
  SGC_STAGES,
  SGC_OBSERVACION_ESTADOS,
  SGC_OBSERVACION_IMPLICITA_PREFIX,
  TIPOS_DOCUMENTO_SOLICITUD,
  TIPOS_SOLICITUD,
  SGC_CONTRACT_TYPE_CODES,
} from "@/lib/shared/constants";
const CONFIG: SgcIntegracionConfig = {
  enabled: true,
  areaCode: "EVENTOS",
  contractTypeCode: "AUSPICIO",
};
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
    createdAt: new Date("2026-09-15T00:00:00.000Z"),
    revisiones: [],
    reevaluaciones: [],
    revisionAsociado: null,
    revisionLegal: null,
    tieneFacturacion: false,
    tipoFacturacion: null,
    facturacionId: null,
    sgcEstadoEnvio: null,
    sgcLifecycleStatus: null,
    sgcStage: null,
    sgcSubsanacionMotivo: null,
    sgcDocumentosEnviados: false,
    sgcEnabled: false,
    ...overrides,
  };
}
function expediente(
  overrides: Partial<SgcExpedienteEntity> = {},
): SgcExpedienteEntity {
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
    subsanacionMotivo: null,
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
    actualizarExpediente: vi
      .fn()
      .mockImplementation((_id: string, data: Partial<SgcExpedienteEntity>) =>
        Promise.resolve(expediente(data)),
      ),
    crearDocumento: vi.fn(),
    actualizarDocumento: vi.fn(),
    crearSubsanacion: vi.fn(),
    listarSubsanaciones: vi.fn().mockResolvedValue([]),
    marcarSubsanacionReenviada: vi.fn().mockResolvedValue(undefined),
  };
}
function clientMock(): ISgcClient {
  return {
    crearExpediente: vi
      .fn()
      .mockResolvedValue({
        contractId: "contract-1",
        status: SGC_CREATE_STATUS.CREATED,
      }),
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
    touchAuditoria: vi.fn(),
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
    findDocumentoPorHashEnOtraSolicitud: vi.fn(),
    observarDocumentos: vi.fn(),
    marcarDocumentosReemplazados: vi.fn(),
    marcarDocumentosReemplazadosPorIds: vi.fn(),
    eliminarDocumento: vi.fn(),
    crearAlertaRevision: vi.fn(),
    crearAlertaRol: vi.fn(),
    findNombreUsuario: vi.fn().mockResolvedValue(null),
    guardarRecortePlano: vi.fn(),
    guardarPlanCuotas: vi.fn(),
    cambiarMonedaSolicitud: vi.fn(),
    habilitarContrato: vi.fn(),
    upsertContratoSistema: vi.fn(),
    guardarReservaIImp: vi.fn(),
    datosReservaIImp: vi.fn(),
    findSolicitudIdPorNumeroIImp: vi.fn(),
    findSolicitudIdPorContrato: vi.fn(),
    listarIdsPorEmpresa: vi.fn().mockResolvedValue([]),
    actualizarRequisitosFacturacion: vi.fn(),
  };
}
function documentoOrigenMock(): IDocumentoOrigen {
  return { leer: vi.fn() };
}
describe("SgcIntegracionApplicationService.crearExpedienteDesdeSolicitud", () => {
  it("deberia no hacer nada cuando la integracion esta deshabilitada", async () => {
    const repo = sgcRepoMock(null);
    const client = clientMock();
    const svc = new SgcIntegracionApplicationService(
      solicitudRepoMock(detalle()),
      repo,
      client,
      documentoOrigenMock(),
      { ...CONFIG, enabled: false },
    );
    const result = await svc.crearExpedienteDesdeSolicitud("sol-1");
    expect(result).toBeNull();
    expect(repo.findExpedientePorSolicitud).not.toHaveBeenCalled();
    expect(client.crearExpediente).not.toHaveBeenCalled();
  });
  it("deberia crear el expediente y persistir la correlacion con contractId", async () => {
    const repo = sgcRepoMock(null);
    const client = clientMock();
    const svc = new SgcIntegracionApplicationService(
      solicitudRepoMock(detalle()),
      repo,
      client,
      documentoOrigenMock(),
      CONFIG,
    );
    const result = await svc.crearExpedienteDesdeSolicitud("sol-1");
    expect(client.crearExpediente).toHaveBeenCalledWith(
      expect.objectContaining({ code: expect.stringMatching(/^STAND-STAND-1-[A-Z0-9-]{1,31}$/) }),
      /* Intencion = solicitud + hash del contenido (16 hex). */
      expect.stringMatching(new RegExp(`^${SGC_IDEMPOTENCY_PREFIX}/sol-1/[0-9a-f]{16}$`)),
    );
    expect(repo.actualizarExpediente).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({
        contractId: "contract-1",
        estadoEnvio: SGC_ESTADO_ENVIO.CREADO,
      }),
    );
    expect(result?.contractId).toBe("contract-1");
  });

  it("usa PABELLONES_INTERNACIONALES para solicitudes de reservar-empresa", async () => {
    const repo = sgcRepoMock(null);
    const client = clientMock();
    const svc = new SgcIntegracionApplicationService(
      solicitudRepoMock(detalle({ tipo: TIPOS_SOLICITUD.RESERVA_EMPRESA })),
      repo,
      client,
      documentoOrigenMock(),
      CONFIG,
    );

    await svc.crearExpedienteDesdeSolicitud("sol-1");

    expect(client.crearExpediente).toHaveBeenCalledWith(
      expect.objectContaining({
        areaCode: "EVENTOS",
        contractTypeCode: SGC_CONTRACT_TYPE_CODES.RESERVA_EMPRESA,
      }),
      expect.any(String),
    );
    expect(repo.crearExpediente).toHaveBeenCalledWith(expect.objectContaining({
      areaCode: "EVENTOS",
      contractTypeCode: SGC_CONTRACT_TYPE_CODES.RESERVA_EMPRESA,
    }));
  });

  it("mantiene el tipo de contrato configurado para una solicitud regular", async () => {
    const repo = sgcRepoMock(null);
    const client = clientMock();
    const svc = new SgcIntegracionApplicationService(
      solicitudRepoMock(detalle()),
      repo,
      client,
      documentoOrigenMock(),
      CONFIG,
    );

    await svc.crearExpedienteDesdeSolicitud("sol-1");

    expect(client.crearExpediente).toHaveBeenCalledWith(
      expect.objectContaining({ contractTypeCode: CONFIG.contractTypeCode }),
      expect.any(String),
    );
  });

  it("deberia ser idempotente si el expediente ya fue creado", async () => {
    const repo = sgcRepoMock(
      expediente({
        estadoEnvio: SGC_ESTADO_ENVIO.CREADO,
        contractId: "contract-1",
      }),
    );
    const client = clientMock();
    const svc = new SgcIntegracionApplicationService(
      solicitudRepoMock(detalle()),
      repo,
      client,
      documentoOrigenMock(),
      CONFIG,
    );
    const result = await svc.crearExpedienteDesdeSolicitud("sol-1");
    expect(client.crearExpediente).not.toHaveBeenCalled();
    expect(result?.contractId).toBe("contract-1");
  });
  it("deberia registrar el error y no lanzar cuando el SGC falla", async () => {
    const repo = sgcRepoMock(null);
    const client = clientMock();
    vi.mocked(client.crearExpediente).mockRejectedValue(new Error("SGC 503"));
    const svc = new SgcIntegracionApplicationService(
      solicitudRepoMock(detalle()),
      repo,
      client,
      documentoOrigenMock(),
      CONFIG,
    );
    const result = await svc.crearExpedienteDesdeSolicitud("sol-1");
    expect(result).toBeNull();
    expect(repo.actualizarExpediente).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({
        estadoEnvio: SGC_ESTADO_ENVIO.ERROR,
        lastError: "SGC 503",
      }),
    );
  });
  it("deberia no llamar al SGC si no existe la solicitud", async () => {
    const repo = sgcRepoMock(null);
    const client = clientMock();
    const svc = new SgcIntegracionApplicationService(
      solicitudRepoMock(null),
      repo,
      client,
      documentoOrigenMock(),
      CONFIG,
    );
    const result = await svc.crearExpedienteDesdeSolicitud("sol-1");
    expect(result).toBeNull();
    expect(client.crearExpediente).not.toHaveBeenCalled();
  });
});

describe("SgcIntegracionApplicationService.aprobarBypass", () => {
  function build(solicitudes: ISolicitudesRepository, repo = sgcRepoMock(expediente({ contractId: "contract-1" }))) {
    return new SgcIntegracionApplicationService(solicitudes, repo, clientMock(), documentoOrigenMock(), CONFIG);
  }
  it("deberia marcar Vigente y generar la orden de pago automaticamente", async () => {
    const solicitudes = solicitudRepoMock(detalle());
    const svc = build(solicitudes);
    const ok = await svc.aprobarBypass("sol-1", "admin@iimp.org.pe");
    expect(ok).toBe(true);
    expect(vi.mocked(solicitudes.marcarOrdenPago)).toHaveBeenCalledWith("sol-1");
  });
  it("deberia completar la orden de pago si esta pendiente y aun no existe facturacion", async () => {
    const solicitudes = solicitudRepoMock(detalle({ estado: ESTADOS_SOLICITUD.PENDIENTE_PAGO }));
    const svc = build(solicitudes);
    await svc.aprobarBypass("sol-1", "admin@iimp.org.pe");
    expect(vi.mocked(solicitudes.marcarOrdenPago)).toHaveBeenCalledWith("sol-1");
  });
  it("deberia no lanzar ni revertir el bypass si la orden de pago falla (best-effort)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const solicitudes = solicitudRepoMock(detalle());
    vi.mocked(solicitudes.marcarOrdenPago).mockRejectedValue(new Error("db caida"));
    const svc = build(solicitudes);
    const ok = await svc.aprobarBypass("sol-1", "admin@iimp.org.pe");
    expect(ok).toBe(true);
    spy.mockRestore();
  });
  it("deberia no generar la orden si el expediente no existe", async () => {
    const solicitudes = solicitudRepoMock(detalle());
    const svc = build(solicitudes, sgcRepoMock(null));
    const ok = await svc.aprobarBypass("sol-1", "admin@iimp.org.pe");
    expect(ok).toBe(false);
    expect(vi.mocked(solicitudes.marcarOrdenPago)).not.toHaveBeenCalled();
  });
});

describe("SgcIntegracionApplicationService.reenviarCorreccionAlSgc", () => {
  it("versiona el contrato aunque la observacion se haya mapeado como contrato_firmado", async () => {
    const observacion = {
      observationId: "obs-contrato",
      documentId: "sgc-contract-1",
      categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
      title: "Contrato firmado",
      message: "Corrige el contrato",
      status: SGC_OBSERVACION_ESTADOS.OPEN,
      requiresDocumentChange: true,
      createdAt: "2026-11-01T00:00:00.000Z",
    };
    const row = detalle({
      sgcObservaciones: [observacion],
      docsAdjuntos: [{
        id: "firmado",
        url: "/uploads/contrato-firmado.pdf",
        nombre: "contrato-firmado.pdf",
        userId: "user-1",
        uploadedBy: "cliente@x.pe",
        categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
        requisito: null,
        estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
        createdAt: new Date("2026-11-12T20:20:00.000Z"),
      }],
    });
    const client = clientMock();
    vi.mocked(client.consultarExpediente).mockResolvedValue({
      lifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED,
      documents: [{
        documentId: "sgc-contract-1",
        category: "contract",
        title: "Contrato",
        currentVersionId: "version-old",
      }],
      version: 3,
    } as never);
    const repo = sgcRepoMock(expediente({
      contractId: "contract-1",
      lifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED,
      observaciones: [observacion],
    }));
    vi.mocked(repo.crearSubsanacion).mockResolvedValue({
      id: "sub-1",
      sgcExpedienteId: "exp-1",
      ronda: 1,
      motivo: "Corrige el contrato",
      estado: "declarado",
      declaradoPor: "admin@iimp.org.pe",
      declaradoAt: new Date(),
      reenviadoPor: null,
      reenviadoAt: null,
      documentId: null,
      versionId: null,
    });
    const svc = new SgcIntegracionApplicationService(
      solicitudRepoMock(row),
      repo,
      client,
      documentoOrigenMock(),
      CONFIG,
    );
    const subir = vi.spyOn(svc, "subirDocumentoDesdeUrl").mockResolvedValue({
      documentId: "sgc-contract-1",
      currentVersionId: "version-new",
    } as never);

    await svc.reenviarCorreccionAlSgc("sol-1", "admin@iimp.org.pe");

    expect(subir).toHaveBeenCalledWith(
      "sol-1",
      expect.objectContaining({
        category: "contract",
        documentId: "sgc-contract-1",
      }),
    );
  });

  /* Devolucion sin observations[] abiertas (casos ESAN/COMISUB): la copia local solo
   * trae observaciones resueltas de rondas previas. Guia §8: exige version del contrato. */
  const firmadoCliente = {
    id: "firmado",
    url: "/uploads/contrato-firmado.pdf",
    nombre: "contrato-firmado.pdf",
    userId: "user-1",
    uploadedBy: "cliente@x.pe",
    categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
    requisito: null,
    estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
    createdAt: new Date("2026-11-23T13:19:00.000Z"),
  };
  const resuelta = {
    observationId: "obs-vieja",
    documentId: "sgc-vigencia",
    category: "annex",
    title: "Vigencia de Poder",
    message: "Corrige el adjunto",
    status: SGC_OBSERVACION_ESTADOS.RESOLVED,
    requiresDocumentChange: true,
    createdAt: "2026-11-19T17:11:00.000Z",
  };
  const armarDevolucionSinObservaciones = (checksumPrevio: string | null) => {
    const client = clientMock();
    vi.mocked(client.consultarExpediente).mockResolvedValue({
      lifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED,
      documents: [{ documentId: "sgc-contract-1", category: "contract", title: "Contrato", currentVersionId: "v3" }],
      version: 7,
    } as never);
    const repo = sgcRepoMock(expediente({
      contractId: "contract-1",
      lifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED,
      observaciones: [resuelta],
    }));
    vi.mocked(repo.crearSubsanacion).mockResolvedValue(null as never);
    repo.buscarDocumento = vi.fn().mockResolvedValue(
      checksumPrevio ? { documentId: "sgc-contract-1", checksumSha256: checksumPrevio } : null,
    );
    const origen = documentoOrigenMock();
    vi.mocked(origen.leer).mockResolvedValue({
      bytes: new TextEncoder().encode("contrato firmado"),
      fileName: "contrato-firmado.pdf",
      mimeType: "application/pdf",
    } as never);
    const svc = new SgcIntegracionApplicationService(
      solicitudRepoMock(detalle({ sgcObservaciones: [resuelta], docsAdjuntos: [firmadoCliente] })),
      repo,
      client,
      origen,
      CONFIG,
    );
    const anexos = vi.spyOn(svc, "subirAnexosDeSolicitud").mockResolvedValue([]);
    const subir = vi.spyOn(svc, "subirDocumentoDesdeUrl").mockResolvedValue({
      documentId: "sgc-contract-1",
      currentVersionId: "version-new",
    } as never);
    return { svc, client, anexos, subir };
  };

  it("sin observaciones abiertas exige y sube una version nueva del contrato", async () => {
    const { svc, client, subir } = armarDevolucionSinObservaciones(null);

    await svc.reenviarCorreccionAlSgc("sol-1", "cliente@x.pe");

    expect(subir).toHaveBeenCalledWith("sol-1", expect.objectContaining({ category: "contract", documentId: "sgc-contract-1" }));
    expect(client.reabrirExpediente).toHaveBeenCalledTimes(1);
  });

  it("si el contrato es el mismo que ya reviso el SGC, avisa sin subir anexos ni reenviar", async () => {
    const checksum = await sha256Hex(new TextEncoder().encode("contrato firmado"));
    const { svc, client, anexos, subir } = armarDevolucionSinObservaciones(checksum);

    await expect(svc.reenviarCorreccionAlSgc("sol-1", "cliente@x.pe")).rejects.toThrow(/versión nueva del contrato/);
    expect(anexos).not.toHaveBeenCalled();
    expect(subir).not.toHaveBeenCalled();
    expect(client.reabrirExpediente).not.toHaveBeenCalled();
  });
});

/* Caso ESAN: el SGC devolvio sin `observations[]` abiertas. Exige version nueva del contrato,
 * pero sin observacion el cliente no tenia como firmar de nuevo (callejon sin salida). */
describe("SgcIntegracionApplicationService.consultarExpediente — devolucion sin observaciones", () => {
  const resuelta = {
    observationId: "obs-vieja",
    documentId: "sgc-vig",
    category: "annex",
    title: "Vigencia de Poder",
    message: "Corrige el adjunto",
    status: SGC_OBSERVACION_ESTADOS.RESOLVED,
    createdAt: "2026-11-20 16:31:46+00",
  };
  const detalleSgc = (overrides: Record<string, unknown> = {}) => ({
    contractId: "contract-1",
    lifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED,
    stage: SGC_STAGES.DRAFTING,
    version: 5,
    updatedAt: "2026-11-23 15:21:52.725+00",
    documents: [
      { documentId: "sgc-contrato", category: "contract", title: "Contrato de separación de stand v1", currentVersionId: "v1", observations: [] },
      { documentId: "sgc-vig", category: "annex", title: "Vigencia de Poder", currentVersionId: "v2", observations: [resuelta] },
    ],
    missingDocuments: [],
    ...overrides,
  });
  async function sincronizar(detalleMock: Record<string, unknown>, exp: Partial<SgcExpedienteEntity> = {}) {
    const client = clientMock();
    vi.mocked(client.consultarExpediente).mockResolvedValue(detalleMock as never);
    const repo = sgcRepoMock(expediente({
      contractId: "contract-1",
      estadoEnvio: SGC_ESTADO_ENVIO.CREADO,
      lifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED,
      observaciones: [resuelta],
      ...exp,
    }));
    const svc = new SgcIntegracionApplicationService(solicitudRepoMock(null), repo, client, documentoOrigenMock(), CONFIG);
    await svc.consultarExpediente("sol-1", { regenerarContrato: false });
    const guardadas = vi.mocked(repo.actualizarExpediente).mock.calls
      .map(([, data]) => data.observaciones)
      .find((o) => Array.isArray(o)) as Array<Record<string, unknown>> | undefined;
    return guardadas ?? [];
  }

  it("sintetiza una observacion abierta del contrato con la fecha de la devolucion", async () => {
    const obs = await sincronizar(detalleSgc());
    const implicita = obs.find((o) => String(o.observationId).startsWith(SGC_OBSERVACION_IMPLICITA_PREFIX));
    expect(implicita).toMatchObject({
      observationId: `${SGC_OBSERVACION_IMPLICITA_PREFIX}-v5`,
      documentId: "sgc-contrato",
      category: "contract",
      status: SGC_OBSERVACION_ESTADOS.OPEN,
      requiresDocumentChange: true,
      createdAt: "2026-11-23 15:21:52.725+00",
    });
  });

  it("reutiliza el id y la fecha de la implicita previa mientras dure la devolucion", async () => {
    const previa = { observationId: `${SGC_OBSERVACION_IMPLICITA_PREFIX}-v5`, documentId: "sgc-contrato", category: "contract", message: "x", status: SGC_OBSERVACION_ESTADOS.OPEN, createdAt: "2026-11-23 15:21:52.725+00" };
    const obs = await sincronizar(detalleSgc({ version: 6, updatedAt: "2026-11-24 10:00:00+00" }), { observaciones: [resuelta, previa] });
    expect(obs.find((o) => String(o.observationId).startsWith(SGC_OBSERVACION_IMPLICITA_PREFIX))).toMatchObject({
      observationId: `${SGC_OBSERVACION_IMPLICITA_PREFIX}-v5`,
      createdAt: "2026-11-23 15:21:52.725+00",
    });
  });

  it("no la crea si hay observaciones abiertas, si no exige cambio o si no esta devuelto", async () => {
    const abierta = { ...resuelta, observationId: "obs-nueva", status: SGC_OBSERVACION_ESTADOS.OPEN };
    const conAbierta = await sincronizar(detalleSgc({
      documents: [
        { documentId: "sgc-contrato", category: "contract", title: "Contrato", currentVersionId: "v1", observations: [] },
        { documentId: "sgc-vig", category: "annex", title: "Vigencia de Poder", currentVersionId: "v2", observations: [abierta] },
      ],
    }));
    const sinCambio = await sincronizar(detalleSgc(), { devolucionRequiereCambio: false });
    const enRevision = await sincronizar(detalleSgc({ lifecycleStatus: "legal-review", stage: SGC_STAGES.INTERNAL_REVIEW }));
    for (const obs of [conAbierta, sinCambio, enRevision]) {
      expect(obs.some((o) => String(o.observationId ?? "").startsWith(SGC_OBSERVACION_IMPLICITA_PREFIX))).toBe(false);
    }
  });
});

describe("SgcIntegracionApplicationService.registrarIntentoSubsanacion", () => {
  it("clasifica exito, bloqueo local y error del SGC con el estado del expediente", async () => {
    const repo = sgcRepoMock(expediente({ lifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED }));
    repo.registrarIntentoSubsanacion = vi.fn().mockResolvedValue(undefined);
    const svc = new SgcIntegracionApplicationService(solicitudRepoMock(detalle()), repo, clientMock(), documentoOrigenMock(), CONFIG);
    const base = { solicitudId: "sol-1", origen: SGC_INTENTO_ORIGENES.CLIENTE, actor: "c@x.pe" } as const;

    await svc.registrarIntentoSubsanacion(base);
    await svc.registrarIntentoSubsanacion({ ...base, error: new DomainError("Falta firmar", API_ERROR_CODES.CONFLICT, 409) });
    await svc.registrarIntentoSubsanacion({ ...base, error: new SgcApiError("SGC 422: Sube una versión nueva", 422) });

    const llamadas = vi.mocked(repo.registrarIntentoSubsanacion!).mock.calls.map(([d]) => [d.resultado, d.httpStatus, d.sgcLifecycle]);
    expect(llamadas).toEqual([
      [SGC_INTENTO_RESULTADOS.EXITO, null, SGC_LIFECYCLE_STATUSES.OBSERVED],
      [SGC_INTENTO_RESULTADOS.VALIDACION, 409, SGC_LIFECYCLE_STATUSES.OBSERVED],
      [SGC_INTENTO_RESULTADOS.ERROR_SGC, 422, SGC_LIFECYCLE_STATUSES.OBSERVED],
    ]);
  });

  it("nunca rompe el flujo si el registro falla", async () => {
    const repo = sgcRepoMock(expediente());
    repo.registrarIntentoSubsanacion = vi.fn().mockRejectedValue(new Error("db caida"));
    const svc = new SgcIntegracionApplicationService(solicitudRepoMock(detalle()), repo, clientMock(), documentoOrigenMock(), CONFIG);
    await expect(svc.registrarIntentoSubsanacion({ solicitudId: "sol-1", origen: SGC_INTENTO_ORIGENES.ADMIN, actor: null })).resolves.toBeUndefined();
  });
});

describe("SgcIntegracionApplicationService.enviarExpedienteAlSgc", () => {
  it("inicia la ronda con resend cuando el SGC queda en draft", async () => {
    const repo = sgcRepoMock(expediente({
      contractId: "contract-1",
      estadoEnvio: SGC_ESTADO_ENVIO.CREADO,
    }));
    const client = clientMock();
    vi.mocked(client.consultarExpediente).mockResolvedValue({
      lifecycleStatus: SGC_LIFECYCLE_STATUSES.DRAFT,
      stage: SGC_STAGES.DRAFTING,
      version: 1,
      documents: [],
    } as never);
    const svc = new SgcIntegracionApplicationService(
      solicitudRepoMock(detalle()),
      repo,
      client,
      documentoOrigenMock(),
      CONFIG,
    );
    vi.spyOn(svc, "subirContratoDeSolicitud").mockResolvedValue(null);
    vi.spyOn(svc, "subirAnexosDeSolicitud").mockResolvedValue([]);
    vi.spyOn(svc, "consultarExpediente").mockResolvedValue(null);

    await svc.enviarExpedienteAlSgc("sol-1", "admin@iimp.org.pe");

    expect(client.reabrirExpediente).toHaveBeenCalledWith(
      "contract-1",
      expect.stringContaining("/inicial-v1"),
    );
  });

  it("no reabre una revision ya iniciada", async () => {
    const repo = sgcRepoMock(expediente({
      contractId: "contract-1",
      estadoEnvio: SGC_ESTADO_ENVIO.CREADO,
      lifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED,
    }));
    const client = clientMock();
    vi.mocked(client.consultarExpediente).mockResolvedValue({
      lifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED,
      stage: SGC_STAGES.DRAFTING,
      version: 3,
      documents: [],
    } as never);
    const svc = new SgcIntegracionApplicationService(
      solicitudRepoMock(detalle()),
      repo,
      client,
      documentoOrigenMock(),
      CONFIG,
    );
    vi.spyOn(svc, "subirContratoDeSolicitud").mockResolvedValue(null);
    vi.spyOn(svc, "subirAnexosDeSolicitud").mockResolvedValue([]);
    vi.spyOn(svc, "reenviarCorreccionAlSgc").mockResolvedValue({ reenviado: true, documento: null });
    vi.spyOn(svc, "consultarExpediente").mockResolvedValue(null);

    await svc.enviarExpedienteAlSgc("sol-1", "admin@iimp.org.pe");

    expect(client.reabrirExpediente).not.toHaveBeenCalled();
  });
});
