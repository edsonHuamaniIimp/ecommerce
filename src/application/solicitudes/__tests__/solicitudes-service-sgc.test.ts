import { describe, it, expect, vi } from "vitest";
import { SolicitudesApplicationService } from "../solicitudes-service";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { ISgcRepository } from "@/domain/ports/sgc-repository";
import type { ISgcClient } from "@/domain/ports/sgc-client";
import { SgcIntegracionApplicationService } from "@/application/sgc-integracion/sgc-integracion-service";
import type { RevisionEntity, SolicitudRow } from "@/domain/models/entities";
import { REVISION_AREAS, RESULTADOS_APROBACION, ESTADOS_SOLICITUD, TIPOS_DOCUMENTO_SOLICITUD, ALERTA_TIPOS, ROLES, ANEXOS_KEYS, SGC_LIFECYCLE_STATUSES, SGC_STAGES, TIPOS_SOLICITUD, ORIGENES_DOCUMENTO, PERMISSIONS, ESTADOS_DOCUMENTO_SOLICITUD } from "@/lib/shared/constants";
import { sha256Hex } from "@/lib/shared/utils/sgc";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {},
}));
vi.stubEnv("SGC_ENABLED", "1");

vi.mock("@/lib/server/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  enviarEmailPlantilla: vi.fn().mockResolvedValue(true),
}));

function revision(
  area: string,
  estado: string,
  estadoAnterior: string | null = RESULTADOS_APROBACION.PENDIENTE,
  fuePrimeraRevision = true,
): RevisionEntity {
  return {
    id: "r1",
    solicitudId: "sol-1",
    area,
    estado,
    comentario: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date("2026-09-15T00:00:00.000Z"),
    updatedAt: new Date("2026-09-15T00:00:00.000Z"),
    estadoAnterior,
    fuePrimeraRevision,
  };
}

function repoMock(area: string, estado: string): ISolicitudesRepository {
  return {
    listar: vi.fn(),
    detalle: vi.fn().mockResolvedValue(null),
    crearOActualizarRevision: vi.fn().mockResolvedValue(revision(area, estado)),
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
    findDocumentoPorHashEnOtraSolicitud: vi.fn().mockResolvedValue(null),
    observarDocumentos: vi.fn(),
    marcarDocumentosReemplazados: vi.fn(),
    marcarDocumentosReemplazadosPorIds: vi.fn(),
    eliminarDocumento: vi.fn(),
    crearAlertaRevision: vi.fn().mockResolvedValue(undefined),
    crearAlertaRol: vi.fn().mockResolvedValue(undefined),
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

function sgcRepoVacio(): ISgcRepository {
  return {
    findExpedientePorSolicitud: vi.fn(),
    findExpedientePorContractId: vi.fn(),
    listarConContractId: vi.fn(),
    listarConEstadoEnvio: vi.fn().mockResolvedValue([]),
    crearExpediente: vi.fn(),
    actualizarExpediente: vi.fn(),
    crearDocumento: vi.fn(),
    actualizarDocumento: vi.fn(),
    crearSubsanacion: vi.fn(),
    listarSubsanaciones: vi.fn().mockResolvedValue([]),
    marcarSubsanacionReenviada: vi.fn(),
  };
}

function sgcClientVacio(): ISgcClient {
  return {
    crearExpediente: vi.fn(),
    actualizarExpediente: vi.fn(),
    consultarExpediente: vi.fn(),
    listarExpedientes: vi.fn(),
    reservarSubida: vi.fn(),
    transferirArchivo: vi.fn(),
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

function sgcMock(): SgcIntegracionApplicationService {
  const svc = new SgcIntegracionApplicationService(
    repoMock(REVISION_AREAS.LEGAL, RESULTADOS_APROBACION.APROBADO),
    sgcRepoVacio(),
    sgcClientVacio(),
    { leer: vi.fn() },
    { enabled: false, areaCode: "", contractTypeCode: "" },
  );
  vi.spyOn(svc, "crearExpedienteDesdeSolicitud").mockResolvedValue(null);
  vi.spyOn(svc, "enviarExpedienteAlSgc").mockResolvedValue(undefined);
  return svc;
}

function detalleMultistand(overrides: Partial<SolicitudRow> = {}): SolicitudRow {
  return {
    id: "sol-1",
    gessStandId: null,
    standCode: "A-1, A-2",
    standCodes: ["A-1", "A-2"],
    tipoStand: null,
    medidas: null,
    empresa: null,
    email: null,
    userId: "user-1",
    bloqueId: null,
    estado: null,
    estadoSolicitud: ESTADOS_SOLICITUD.PENDIENTE,
    flgActivo: true,
    documentos: [],
    imagenes: [],
    docsAdjuntosCount: 1,
    clienteDocsAdjuntosCount: 0,
    docsAdminCount: 1,
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

describe("SolicitudesApplicationService + SGC", () => {
  it("deberia delegar al SGC al aprobar Asociado (unico nivel local)", async () => {
    const sgc = sgcMock();
    const svc = new SolicitudesApplicationService(repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.APROBADO), sgc);

    await svc.revisar({
      solicitudId: "sol-1",
      area: REVISION_AREAS.ASOCIADO,
      estado: RESULTADOS_APROBACION.APROBADO,
      reviewerEmail: "asociado@iimp.org.pe",
    });

    expect(sgc.crearExpedienteDesdeSolicitud).toHaveBeenCalledWith("sol-1");
  });

  it("deberia disparar SGC al aprobar despues de una observacion", async () => {
    const sgc = sgcMock();
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.APROBADO);
    repo.crearOActualizarRevision = vi.fn().mockResolvedValue(
      revision(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.APROBADO, RESULTADOS_APROBACION.OBSERVADO, false),
    );
    const svc = new SolicitudesApplicationService(repo, sgc);

    await svc.revisar({
      solicitudId: "sol-1",
      area: REVISION_AREAS.ASOCIADO,
      estado: RESULTADOS_APROBACION.APROBADO,
      reviewerEmail: "asociado@iimp.org.pe",
    });

    expect(sgc.crearExpedienteDesdeSolicitud).toHaveBeenCalledWith("sol-1");
    expect(sgc.enviarExpedienteAlSgc).toHaveBeenCalledWith("sol-1", "asociado@iimp.org.pe");
  });

  it("no reenvia al SGC si la revision ya estaba aprobada", async () => {
    const sgc = sgcMock();
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.APROBADO);
    repo.crearOActualizarRevision = vi.fn().mockResolvedValue(
      revision(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.APROBADO, RESULTADOS_APROBACION.APROBADO, false),
    );
    const svc = new SolicitudesApplicationService(repo, sgc);

    await svc.revisar({
      solicitudId: "sol-1",
      area: REVISION_AREAS.ASOCIADO,
      estado: RESULTADOS_APROBACION.APROBADO,
      reviewerEmail: "asociado@iimp.org.pe",
    });

    expect(sgc.crearExpedienteDesdeSolicitud).not.toHaveBeenCalled();
  });

  it("bloquea cambios locales mientras el SGC esta en revision Legal", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.APROBADO);
    repo.detalle = vi.fn().mockResolvedValue(
      detalleMultistand({ sgcEnabled: true, sgcStage: SGC_STAGES.INTERNAL_REVIEW }),
    );
    const svc = new SolicitudesApplicationService(repo, sgcMock());

    await expect(
      svc.revisar({
        solicitudId: "sol-1",
        area: REVISION_AREAS.ASOCIADO,
        estado: RESULTADOS_APROBACION.APROBADO,
        reviewerEmail: "asociado@iimp.org.pe",
      }),
    ).rejects.toThrow(/revision Legal/);
    expect(repo.crearOActualizarRevision).not.toHaveBeenCalled();
  });

  it("deberia no disparar si Asociado aun queda pendiente", async () => {
    const sgc = sgcMock();
    const svc = new SolicitudesApplicationService(repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE), sgc);

    await svc.revisar({
      solicitudId: "sol-1",
      area: REVISION_AREAS.ASOCIADO,
      estado: RESULTADOS_APROBACION.PENDIENTE,
      reviewerEmail: "asociado@iimp.org.pe",
    });

    expect(sgc.crearExpedienteDesdeSolicitud).not.toHaveBeenCalled();
  });

  it("deberia no disparar en la revision Legal (delegada al SGC)", async () => {
    const sgc = sgcMock();
    const svc = new SolicitudesApplicationService(repoMock(REVISION_AREAS.LEGAL, RESULTADOS_APROBACION.APROBADO), sgc);

    await svc.revisar({
      solicitudId: "sol-1",
      area: REVISION_AREAS.LEGAL,
      estado: RESULTADOS_APROBACION.APROBADO,
      reviewerEmail: "legal@iimp.org.pe",
    });

    expect(sgc.crearExpedienteDesdeSolicitud).not.toHaveBeenCalled();
  });

  it("deberia alertar al admin cuando el cliente sube el contrato firmado", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE);
    repo.detalle = vi.fn().mockResolvedValue(detalleMultistand());
    const svc = new SolicitudesApplicationService(repo, sgcMock());

    await svc.uploadDocumento({
      solicitudId: "sol-1",
      url: "/uploads/firmado.pdf",
      nombre: "firmado.pdf",
      userSub: "user-1",
      userEmail: "cliente@iimp.org.pe",
      userPermissions: [],
      tipo: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
      firmaDigital: true,
    });

    expect(repo.crearDocumentoAdjunto).toHaveBeenCalledWith(
      "sol-1", "/uploads/firmado.pdf", "firmado.pdf", "user-1", "cliente@iimp.org.pe", "contrato_firmado", null, null,
    );
    expect(repo.crearAlertaRol).toHaveBeenCalledWith(expect.objectContaining({
      rol: ROLES.ADMIN,
      tipo: ALERTA_TIPOS.CONTRATO_FIRMADO,
      url: expect.stringContaining("/dashboard/solicitudes?id=sol-1"),
    }));
  });

  it("no deberia alertar al admin cuando el cliente sube anexos", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE);
    repo.detalle = vi.fn().mockResolvedValue(detalleMultistand());
    const svc = new SolicitudesApplicationService(repo, sgcMock());

    await svc.uploadDocumento({
      solicitudId: "sol-1",
      url: "/uploads/anexo.pdf",
      nombre: "anexo.pdf",
      userSub: "user-1",
      userEmail: "cliente@iimp.org.pe",
      userPermissions: [],
      tipo: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
    });

    expect(repo.crearAlertaRol).not.toHaveBeenCalled();
  });

  it("rechaza la Ficha RUC en un formato distinto de PDF (regla backend)", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE);
    repo.detalle = vi.fn().mockResolvedValue(detalleMultistand());
    const svc = new SolicitudesApplicationService(repo, sgcMock());

    await expect(
      svc.uploadDocumento({
        solicitudId: "sol-1",
        url: "/uploads/ficha.png",
        nombre: "ficha.png",
        userSub: "user-1",
        userEmail: "cliente@iimp.org.pe",
        userPermissions: [],
        tipo: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
        requisito: ANEXOS_KEYS.FICHA_RUC,
      }),
    ).rejects.toThrow(/PDF/);
    expect(repo.crearDocumentoAdjunto).not.toHaveBeenCalled();
  });

  it("rechaza la Vigencia de Poder en imagen (solo PDF)", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE);
    repo.detalle = vi.fn().mockResolvedValue(detalleMultistand());
    const svc = new SolicitudesApplicationService(repo, sgcMock());

    await expect(
      svc.uploadDocumento({
        solicitudId: "sol-1",
        url: "/uploads/vigencia.jpg",
        nombre: "vigencia.jpg",
        userSub: "user-1",
        userEmail: "cliente@iimp.org.pe",
        userPermissions: [],
        tipo: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
        requisito: ANEXOS_KEYS.VIGENCIA_PODER,
      }),
    ).rejects.toThrow(/PDF/);
    expect(repo.crearDocumentoAdjunto).not.toHaveBeenCalled();
  });

  it("permite el DNI o Pasaporte en PNG (imagen del documento)", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE);
    repo.detalle = vi.fn().mockResolvedValue(detalleMultistand());
    const svc = new SolicitudesApplicationService(repo, sgcMock());

    await svc.uploadDocumento({
      solicitudId: "sol-1",
      url: "/uploads/dni.png",
      nombre: "dni.png",
      userSub: "user-1",
      userEmail: "cliente@iimp.org.pe",
      userPermissions: [],
      tipo: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
      requisito: ANEXOS_KEYS.DNI_REPRESENTANTE,
    });

    expect(repo.crearDocumentoAdjunto).toHaveBeenCalled();
  });

  it("permite otros documentos (anexo sin requisito) en otros formatos", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE);
    repo.detalle = vi.fn().mockResolvedValue(detalleMultistand());
    const svc = new SolicitudesApplicationService(repo, sgcMock());

    await svc.uploadDocumento({
      solicitudId: "sol-1",
      url: "/uploads/otro.png",
      nombre: "otro.png",
      userSub: "user-1",
      userEmail: "cliente@iimp.org.pe",
      userPermissions: [],
      tipo: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
      requisito: null,
    });

    expect(repo.crearDocumentoAdjunto).toHaveBeenCalled();
  });

  it("rechaza reutilizar en otra solicitud el mismo archivo de contrato firmado (hash)", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE);
    repo.detalle = vi.fn().mockResolvedValue(detalleMultistand());
    vi.mocked(repo.findDocumentoPorHashEnOtraSolicitud).mockResolvedValue({ solicitudId: "otra-sol" });
    const storage = {
      read: vi.fn(async () => ({ bytes: Buffer.from("pdf-firmado"), contentType: "application/pdf" })),
    } as unknown as import("@/lib/server/storage").StorageAdapter;
    const svc = new SolicitudesApplicationService(repo, sgcMock(), storage);

    await expect(
      svc.uploadDocumento({
        solicitudId: "sol-1",
        url: "/uploads/firmado.pdf",
        nombre: "firmado.pdf",
        userSub: "user-1",
        userEmail: "cliente@iimp.org.pe",
        userPermissions: [],
        tipo: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
        firmaDigital: true,
      }),
    ).rejects.toThrow(/otra solicitud/);
    expect(repo.crearDocumentoAdjunto).not.toHaveBeenCalled();
  });

  it("adjunta el contrato firmado propio y persiste su sha256", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE);
    repo.detalle = vi.fn().mockResolvedValue(detalleMultistand());
    const storage = {
      read: vi.fn(async () => ({ bytes: Buffer.from("pdf-firmado"), contentType: "application/pdf" })),
    } as unknown as import("@/lib/server/storage").StorageAdapter;
    const svc = new SolicitudesApplicationService(repo, sgcMock(), storage);

    await svc.uploadDocumento({
      solicitudId: "sol-1",
      url: "/uploads/firmado.pdf",
      nombre: "firmado.pdf",
      userSub: "user-1",
      userEmail: "cliente@iimp.org.pe",
      userPermissions: [],
      tipo: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
      firmaDigital: true,
    });

    expect(repo.crearDocumentoAdjunto).toHaveBeenCalledWith(
      "sol-1",
      "/uploads/firmado.pdf",
      "firmado.pdf",
      "user-1",
      "cliente@iimp.org.pe",
      TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
      null,
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });

  it("guarda el anexo con el mismo nombre canonico que se enviara al SGC", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE);
    repo.detalle = vi.fn().mockResolvedValue(detalleMultistand({ standCode: "STAND-1", standCodes: ["STAND-1"] }));
    const svc = new SolicitudesApplicationService(repo, sgcMock());
    const url = "/uploads/20107972090-01-F009-3303.pdf";
    const hash = (await sha256Hex(new TextEncoder().encode(url))).slice(0, 6);

    await svc.uploadDocumento({
      solicitudId: "sol-1",
      url,
      nombre: "20107972090-01-F009-3303.pdf",
      userSub: "user-1",
      userEmail: "cliente@iimp.org.pe",
      userPermissions: [],
      tipo: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
      requisito: ANEXOS_KEYS.FICHA_RUC,
    });

    expect(repo.crearDocumentoAdjunto).toHaveBeenCalledWith(
      "sol-1",
      url,
      `ficha-ruc-stand-1-${hash}.pdf`,
      "user-1",
      "cliente@iimp.org.pe",
      TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
      ANEXOS_KEYS.FICHA_RUC,
      null,
    );
  });

  it("permite reenviar al SGC cuando el cliente ya firmo el contrato corregido", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.APROBADO);
    const sgc = sgcMock();
    vi.spyOn(sgc, "consultarExpediente").mockResolvedValue(null);
    const reenviar = vi.spyOn(sgc, "reenviarCorreccionAlSgc").mockResolvedValue({ reenviado: true } as never);
    repo.detalle = vi.fn().mockResolvedValue(detalleMultistand({
      estadoSolicitud: ESTADOS_SOLICITUD.OBSERVADO,
      sgcEnabled: true,
      sgcEstadoEnvio: "creado",
      sgcDocumentosEnviados: true,
      sgcLifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED,
      sgcObservaciones: [{
        observationId: "obs-contrato",
        documentId: "doc-sgc-contrato",
        categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
        title: "Contrato de separacion de stand v1",
        message: "Corrige el contrato y vuelve a enviarlo.",
        status: "open",
        requiresDocumentChange: true,
        createdAt: "2026-11-20T22:00:00.000Z",
      }],
      docsAdjuntos: [
        {
          id: "firmado-original",
          url: "/uploads/firmado-original.pdf",
          nombre: "firmado-original.pdf",
          userId: "user-1",
          uploadedBy: "cliente@iimp.org.pe",
          categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
          requisito: null,
          estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
          createdAt: new Date("2026-11-13T19:33:00.000Z"),
        },
        {
          id: "contrato-corregido",
          url: "/uploads/contrato-corregido.pdf",
          nombre: "contrato-corregido.pdf",
          userId: null,
          uploadedBy: "sistema",
          categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
          requisito: null,
          estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
          createdAt: new Date("2026-11-20T22:29:00.000Z"),
        },
        {
          id: "firmado-corregido",
          url: "/uploads/firmado-corregido.pdf",
          nombre: "firmado-corregido.pdf",
          userId: "user-1",
          uploadedBy: "cliente@iimp.org.pe",
          categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
          requisito: null,
          estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
          sgcObservationId: "obs-contrato",
          sgcDocumentId: "doc-sgc-contrato",
          createdAt: new Date("2026-11-20T22:33:00.000Z"),
        },
      ],
    }));
    const svc = new SolicitudesApplicationService(repo, sgc);

    await expect(
      svc.reenviarObservacion("sol-1", "user-1", "cliente@iimp.org.pe"),
    ).resolves.toBeUndefined();
    expect(reenviar).toHaveBeenCalledWith("sol-1", "cliente@iimp.org.pe");
  });
});

describe("SolicitudesApplicationService.detalle con SGC", () => {
  it("sincroniza on-read un caso observado con copia local vencida", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.APROBADO);
    const stale = detalleMultistand({
      sgcEnabled: true,
      sgcEstadoEnvio: "creado",
      sgcLifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED,
      sgcLastSyncedAt: new Date(Date.now() - 5 * 60 * 1000),
    });
    const fresh = {
      ...stale,
      sgcLifecycleStatus: SGC_LIFECYCLE_STATUSES.ACTIVE,
      sgcLastSyncedAt: new Date(),
    };
    repo.detalle = vi.fn().mockResolvedValueOnce(stale).mockResolvedValueOnce(fresh);
    const consultarExpediente = vi.fn().mockResolvedValue({ contractId: "contract-1" });
    const svc = new SolicitudesApplicationService(
      repo,
      { consultarExpediente } as unknown as SgcIntegracionApplicationService,
    );

    const resultado = await svc.detalle("sol-1");

    expect(consultarExpediente).toHaveBeenCalledWith("sol-1");
    expect(resultado?.sgcLifecycleStatus).toBe(SGC_LIFECYCLE_STATUSES.ACTIVE);
  });

  it("no llama al SGC si la ultima sincronizacion esta dentro del TTL", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.APROBADO);
    repo.detalle = vi.fn().mockResolvedValue(detalleMultistand({
      sgcEnabled: true,
      sgcEstadoEnvio: "creado",
      sgcLifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED,
      sgcLastSyncedAt: new Date(),
    }));
    const consultarExpediente = vi.fn();
    const svc = new SolicitudesApplicationService(
      repo,
      { consultarExpediente } as unknown as SgcIntegracionApplicationService,
    );

    await svc.detalle("sol-1");

    expect(consultarExpediente).not.toHaveBeenCalled();
  });
});

describe("SolicitudesApplicationService - firma subida por Asociado", () => {
  const baseDetalle = () =>
    detalleMultistand({
      tipo: TIPOS_SOLICITUD.RESERVA_EMPRESA,
      estadoSolicitud: ESTADOS_SOLICITUD.PENDIENTE,
      contratoHabilitado: true,
      sgcEnabled: true,
      docsAdjuntosCount: 0,
      clienteDocsAdjuntosCount: 0,
      docsAdminCount: 0,
      docsAdjuntos: [],
    });

  it("registra el PDF con auditoria del Asociado y userId del cliente", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE);
    repo.detalle = vi.fn().mockResolvedValue(baseDetalle());
    const svc = new SolicitudesApplicationService(repo, sgcMock());

    await svc.uploadDocumento({
      solicitudId: "sol-1",
      url: "/uploads/contrato-firmado.pdf",
      nombre: "contrato-firmado.pdf",
      userSub: "asociado-1",
      userEmail: "asociado@iimp.org.pe",
      userPermissions: [PERMISSIONS.SOLICITUDES_REVIEW_ASOCIADO],
      tipo: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
      subirFirmaAsociado: true,
    });

    expect(repo.crearDocumentoAdjunto).toHaveBeenCalledWith(
      "sol-1",
      "/uploads/contrato-firmado.pdf",
      "contrato-firmado.pdf",
      "user-1",
      "asociado@iimp.org.pe",
      TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
      null,
      null,
      undefined,
      ORIGENES_DOCUMENTO.SUBIDO_ASOCIADO,
    );
  });

  it("permite al Asociado adjuntar un anexo con auditoria y userId del cliente", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE);
    repo.detalle = vi.fn().mockResolvedValue(baseDetalle());
    const svc = new SolicitudesApplicationService(repo, sgcMock());

    await svc.uploadDocumento({
      solicitudId: "sol-1",
      url: "/uploads/ficha-ruc.pdf",
      nombre: "ficha-ruc.pdf",
      userSub: "asociado-1",
      userEmail: "asociado@iimp.org.pe",
      userPermissions: [PERMISSIONS.SOLICITUDES_REVIEW_ASOCIADO],
      tipo: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
      subirAnexoAsociado: true,
    });

    expect(repo.crearDocumentoAdjunto).toHaveBeenCalledWith(
      "sol-1",
      "/uploads/ficha-ruc.pdf",
      "ficha-ruc.pdf",
      "user-1",
      "asociado@iimp.org.pe",
      TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
      null,
      null,
      undefined,
      ORIGENES_DOCUMENTO.SUBIDO_ASOCIADO,
    );
    expect(repo.marcarDocumentosReemplazados).not.toHaveBeenCalled();
  });

  it("rechaza la carga en nombre del cliente si no es Asociado", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE);
    repo.detalle = vi.fn().mockResolvedValue(baseDetalle());
    const svc = new SolicitudesApplicationService(repo, sgcMock());

    await expect(
      svc.uploadDocumento({
        solicitudId: "sol-1",
        url: "/uploads/contrato-firmado.pdf",
        nombre: "contrato-firmado.pdf",
        userSub: "user-1",
        userEmail: "cliente@iimp.org.pe",
        userPermissions: [],
        tipo: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
        subirFirmaAsociado: true,
      }),
    ).rejects.toThrow(/Solo el Asociado/);
    expect(repo.crearDocumentoAdjunto).not.toHaveBeenCalled();
  });

  it("exige PDF para el contrato firmado subido por el Asociado", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE);
    repo.detalle = vi.fn().mockResolvedValue(baseDetalle());
    const svc = new SolicitudesApplicationService(repo, sgcMock());

    await expect(
      svc.uploadDocumento({
        solicitudId: "sol-1",
        url: "/uploads/contrato-firmado.docx",
        nombre: "contrato-firmado.docx",
        userSub: "asociado-1",
        userEmail: "asociado@iimp.org.pe",
        userPermissions: [PERMISSIONS.SOLICITUDES_REVIEW_ASOCIADO],
        tipo: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
        subirFirmaAsociado: true,
      }),
    ).rejects.toThrow(/PDF/);
    expect(repo.crearDocumentoAdjunto).not.toHaveBeenCalled();
  });

  it("rechaza la carga si no esta en la ventana de firma", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE);
    repo.detalle = vi.fn().mockResolvedValue({
      ...baseDetalle(),
      contratoHabilitado: false,
    });
    const svc = new SolicitudesApplicationService(repo, sgcMock());

    await expect(
      svc.uploadDocumento({
        solicitudId: "sol-1",
        url: "/uploads/contrato-firmado.pdf",
        nombre: "contrato-firmado.pdf",
        userSub: "asociado-1",
        userEmail: "asociado@iimp.org.pe",
        userPermissions: [PERMISSIONS.SOLICITUDES_REVIEW_ASOCIADO],
        tipo: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
        subirFirmaAsociado: true,
      }),
    ).rejects.toThrow(/firma inicial|ventana de firma|observado/);
    expect(repo.crearDocumentoAdjunto).not.toHaveBeenCalled();
  });

  it("rechaza la carga si el contrato vigente no esta observado", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE);
    repo.detalle = vi.fn().mockResolvedValue({
      ...baseDetalle(),
      docsAdjuntos: [
        {
          id: "firmado-1",
          url: "/uploads/firmado.pdf",
          nombre: "firmado.pdf",
          userId: "user-1",
          uploadedBy: "cliente@iimp.org.pe",
          categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
          requisito: null,
          estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
          createdAt: new Date("2026-09-21T10:00:00.000Z"),
        },
      ],
    });
    const svc = new SolicitudesApplicationService(repo, sgcMock());

    await expect(
      svc.uploadDocumento({
        solicitudId: "sol-1",
        url: "/uploads/contrato-firmado.pdf",
        nombre: "contrato-firmado.pdf",
        userSub: "asociado-1",
        userEmail: "asociado@iimp.org.pe",
        userPermissions: [PERMISSIONS.SOLICITUDES_REVIEW_ASOCIADO],
        tipo: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
        subirFirmaAsociado: true,
      }),
    ).rejects.toThrow(/firma inicial|observado/);
    expect(repo.crearDocumentoAdjunto).not.toHaveBeenCalled();
  });

  it("permite reemplazar el contrato firmado cuando esta observado", async () => {
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.OBSERVADO);
    repo.detalle = vi.fn().mockResolvedValue({
      ...baseDetalle(),
      estadoSolicitud: ESTADOS_SOLICITUD.OBSERVADO,
      docsAdjuntos: [
        {
          id: "firmado-1",
          url: "/uploads/firmado.pdf",
          nombre: "firmado.pdf",
          userId: "user-1",
          uploadedBy: "cliente@iimp.org.pe",
          categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
          requisito: null,
          estado: ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO,
          createdAt: new Date("2026-09-21T10:00:00.000Z"),
        },
      ],
    });
    const svc = new SolicitudesApplicationService(repo, sgcMock());

    await svc.uploadDocumento({
      solicitudId: "sol-1",
      url: "/uploads/contrato-firmado.pdf",
      nombre: "contrato-firmado.pdf",
      userSub: "asociado-1",
      userEmail: "asociado@iimp.org.pe",
      userPermissions: [PERMISSIONS.SOLICITUDES_REVIEW_ASOCIADO],
      tipo: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
      subirFirmaAsociado: true,
    });

    expect(repo.crearDocumentoAdjunto).toHaveBeenCalled();
    expect(repo.marcarDocumentosReemplazadosPorIds).not.toHaveBeenCalled();
  });

  function detalleConFirma(origen: string | null): SolicitudRow {
    const contrato = new Date("2026-09-20T10:00:00.000Z");
    const firmado = new Date("2026-09-21T10:00:00.000Z");
    return detalleMultistand({
      tipo: TIPOS_SOLICITUD.RESERVA_EMPRESA,
      estadoSolicitud: ESTADOS_SOLICITUD.PENDIENTE,
      sgcEnabled: true,
      sgcEstadoEnvio: null,
      docsAdjuntos: [
        {
          id: "contrato-1",
          url: "/uploads/contrato.pdf",
          nombre: "contrato.pdf",
          userId: null,
          uploadedBy: "sistema",
          categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
          requisito: null,
          estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
          createdAt: contrato,
        },
        {
          id: "firmado-1",
          url: "/uploads/contrato-firmado.pdf",
          nombre: "contrato-firmado.pdf",
          userId: "user-1",
          uploadedBy: "asociado@iimp.org.pe",
          categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
          requisito: null,
          origen,
          estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
          createdAt: firmado,
        },
      ],
    });
  }

  it("al aprobar Asociado envia al SGC y no genera orden de pago", async () => {
    const sgc = sgcMock();
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.APROBADO);
    repo.detalle = vi.fn().mockResolvedValue(detalleConFirma(ORIGENES_DOCUMENTO.SUBIDO_ASOCIADO));
    const svc = new SolicitudesApplicationService(repo, sgc);

    await svc.revisar({
      solicitudId: "sol-1",
      area: REVISION_AREAS.ASOCIADO,
      estado: RESULTADOS_APROBACION.APROBADO,
      reviewerEmail: "asociado@iimp.org.pe",
    });

    expect(sgc.crearExpedienteDesdeSolicitud).toHaveBeenCalledWith("sol-1");
    expect(sgc.enviarExpedienteAlSgc).toHaveBeenCalledWith("sol-1", "asociado@iimp.org.pe");
    expect(repo.marcarOrdenPago).not.toHaveBeenCalled();
  });

  it("también envía a SGC cuando la firma fue digital del cliente", async () => {
    const sgc = sgcMock();
    const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.APROBADO);
    repo.detalle = vi.fn().mockResolvedValue(detalleConFirma(ORIGENES_DOCUMENTO.PERSONALIZADO));
    const svc = new SolicitudesApplicationService(repo, sgc);

    await svc.revisar({
      solicitudId: "sol-1",
      area: REVISION_AREAS.ASOCIADO,
      estado: RESULTADOS_APROBACION.APROBADO,
      reviewerEmail: "asociado@iimp.org.pe",
    });

    expect(sgc.crearExpedienteDesdeSolicitud).toHaveBeenCalledWith("sol-1");
    expect(sgc.enviarExpedienteAlSgc).toHaveBeenCalledWith("sol-1", "asociado@iimp.org.pe");
    expect(repo.marcarOrdenPago).not.toHaveBeenCalled();
  });
});