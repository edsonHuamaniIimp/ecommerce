import { describe, it, expect, vi } from "vitest";
import { SolicitudesApplicationService } from "../solicitudes-service";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { SolicitudRow } from "@/domain/models/entities";
import { ESTADOS_DOCUMENTO_SOLICITUD, ESTADOS_SOLICITUD, PERMISSIONS, RESULTADOS_APROBACION, REVISION_AREAS, TIPOS_DOCUMENTO_SOLICITUD } from "@/lib/shared/constants";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));
vi.mock("@/lib/server/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  enviarEmailPlantilla: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/server/idioma", () => ({
  resolverIdiomaPeticion: vi.fn().mockResolvedValue("es"),
}));

function repoMock(): ISolicitudesRepository {
  return {
    listar: vi.fn(),
    detalle: vi.fn(),
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
    findDocumentoPorHashEnOtraSolicitud: vi.fn().mockResolvedValue(null),
    observarDocumentos: vi.fn(),
    marcarDocumentosReemplazados: vi.fn(),
    marcarDocumentosReemplazadosPorIds: vi.fn(),
    eliminarDocumento: vi.fn(),
    crearAlertaRevision: vi.fn(),
    crearAlertaRol: vi.fn(),
    findNombreUsuario: vi.fn().mockResolvedValue(null),
    guardarRecortePlano: vi.fn(),
    guardarPlanCuotas: vi.fn(),
    habilitarContrato: vi.fn(),
    upsertContratoSistema: vi.fn(),
    guardarReservaIImp: vi.fn(),
    datosReservaIImp: vi.fn(),
    findSolicitudIdPorNumeroIImp: vi.fn(),
    findSolicitudIdPorContrato: vi.fn(),
  };
}

function svc(repo: ISolicitudesRepository): SolicitudesApplicationService {
  return new SolicitudesApplicationService(repo, {} as never);
}

const ID = "11111111-1111-4111-8111-111111111111";

describe("SolicitudesApplicationService.guardarRecortePlano (RF-08)", () => {
  it("el titular guarda la imagen de su solicitud", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue({ userId: "user-1", flgActivo: true } as unknown as SolicitudRow);
    const service = svc(repo);

    await service.guardarRecortePlano({
      solicitudId: ID,
      url: "/uploads/recorte.png",
      userSub: "user-1",
      userPermissions: [],
    });

    expect(repo.guardarRecortePlano).toHaveBeenCalledWith(ID, "/uploads/recorte.png");
  });

  it("un admin puede guardar en una solicitud ajena", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue({ userId: "otro", flgActivo: true } as unknown as SolicitudRow);
    const service = svc(repo);

    await service.guardarRecortePlano({
      solicitudId: ID,
      url: "/uploads/recorte.png",
      userSub: "admin",
      userPermissions: [PERMISSIONS.ADMIN_FULL],
    });

    expect(repo.guardarRecortePlano).toHaveBeenCalledTimes(1);
  });

  it("rechaza a un usuario ajeno sin permisos", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue({ userId: "otro", flgActivo: true } as unknown as SolicitudRow);
    const service = svc(repo);

    await expect(
      service.guardarRecortePlano({ solicitudId: ID, url: "/uploads/recorte.png", userSub: "intruso", userPermissions: [] }),
    ).rejects.toMatchObject({ status: 403 });
    expect(repo.guardarRecortePlano).not.toHaveBeenCalled();
  });

  it("rechaza una solicitud inexistente", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(null);
    const service = svc(repo);

    await expect(
      service.guardarRecortePlano({ solicitudId: ID, url: "/uploads/recorte.png", userSub: "user-1", userPermissions: [] }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

function detalleObservado(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    email: "cliente@example.com",
    standCode: "A-1",
    estadoSolicitud: ESTADOS_SOLICITUD.OBSERVADO,
    docsAdjuntos: [
      {
        id: "doc-obs",
        nombre: "ficha-ruc.pdf",
        url: "/uploads/ficha-ruc.pdf",
        userId: "user-1",
        requisito: "ficha-ruc",
        categoria: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
        estado: ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO,
        createdAt: "2026-10-01T10:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("SolicitudesApplicationService.revisar (observacion local)", () => {
  const revisionObs = { id: "rev-1", estado: RESULTADOS_APROBACION.OBSERVADO, fuePrimeraRevision: false };

  it("solo el Asociado puede observar", async () => {
    const repo = repoMock();
    const service = svc(repo);

    await expect(
      service.revisar({
        solicitudId: ID,
        area: REVISION_AREAS.LEGAL,
        estado: RESULTADOS_APROBACION.OBSERVADO,
        comentario: "corregir",
        documentosObservados: ["doc-1"],
        reviewerEmail: "rev@iimp.org",
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repo.observarDocumentos).not.toHaveBeenCalled();
  });

  it("exige justificacion", async () => {
    const repo = repoMock();
    const service = svc(repo);

    await expect(
      service.revisar({
        solicitudId: ID,
        area: REVISION_AREAS.ASOCIADO,
        estado: RESULTADOS_APROBACION.OBSERVADO,
        documentosObservados: ["doc-obs"],
        reviewerEmail: "rev@iimp.org",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("exige al menos un documento", async () => {
    const repo = repoMock();
    const service = svc(repo);

    await expect(
      service.revisar({
        solicitudId: ID,
        area: REVISION_AREAS.ASOCIADO,
        estado: RESULTADOS_APROBACION.OBSERVADO,
        comentario: "ilegible",
        documentosObservados: [],
        reviewerEmail: "rev@iimp.org",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rechaza documentos que ya no estan vigentes", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(detalleObservado() as unknown as SolicitudRow);
    const service = svc(repo);

    await expect(
      service.revisar({
        solicitudId: ID,
        area: REVISION_AREAS.ASOCIADO,
        estado: RESULTADOS_APROBACION.OBSERVADO,
        comentario: "ilegible",
        documentosObservados: ["doc-obs"],
        reviewerEmail: "rev@iimp.org",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(repo.observarDocumentos).not.toHaveBeenCalled();
  });

  it("marca los documentos, deja la solicitud observada y notifica al cliente", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(
      detalleObservado({ docsAdjuntos: [{ ...detalleObservado().docsAdjuntos[0], estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO }] }) as unknown as SolicitudRow,
    );
    vi.mocked(repo.observarDocumentos).mockResolvedValue(1);
    vi.mocked(repo.crearAlertaReserva).mockResolvedValue(undefined as never);
    vi.mocked(repo.crearOActualizarRevision).mockResolvedValue(revisionObs as never);
    const service = svc(repo);

    await service.revisar({
      solicitudId: ID,
      area: REVISION_AREAS.ASOCIADO,
      estado: RESULTADOS_APROBACION.OBSERVADO,
      comentario: "ilegible",
      documentosObservados: ["doc-obs"],
      reviewerEmail: "rev@iimp.org",
    });

    expect(repo.observarDocumentos).toHaveBeenCalledWith(ID, ["doc-obs"], "ilegible", "rev@iimp.org");
    expect(repo.crearAlertaReserva).toHaveBeenCalled();
    /* La observacion detiene el flujo: no se alerta al siguiente revisor. */
    expect(repo.crearAlertaRevision).not.toHaveBeenCalled();
  });
});

describe("SolicitudesApplicationService.reenviarObservacion", () => {
  const reemplazo = {
    id: "doc-nuevo",
    nombre: "ficha-ruc-v2.pdf",
    url: "/uploads/ficha-ruc-v2.pdf",
    userId: "user-1",
    requisito: "ficha-ruc",
    categoria: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
    estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
    createdAt: "2026-10-02T10:00:00.000Z",
  };

  it("rechaza reenviar una solicitud ajena", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(detalleObservado() as unknown as SolicitudRow);
    const service = svc(repo);

    await expect(service.reenviarObservacion(ID, "otro", "otro@example.com")).rejects.toMatchObject({ status: 403 });
  });

  it("rechaza si la solicitud no esta observada", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(
      detalleObservado({ estadoSolicitud: ESTADOS_SOLICITUD.EN_PROCESO }) as unknown as SolicitudRow,
    );
    const service = svc(repo);

    await expect(service.reenviarObservacion(ID, "user-1", "cliente@example.com")).rejects.toMatchObject({ status: 409 });
  });

  it("exige nuevas versiones de todos los documentos observados", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(detalleObservado() as unknown as SolicitudRow);
    const service = svc(repo);

    await expect(service.reenviarObservacion(ID, "user-1", "cliente@example.com")).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("Ficha RUC"),
    });
    expect(repo.marcarDocumentosReemplazadosPorIds).not.toHaveBeenCalled();
  });

  it("con todas las versiones nuevas, pasa los observados a reemplazado y vuelve a la cola", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(
      detalleObservado({ docsAdjuntos: [...detalleObservado().docsAdjuntos, reemplazo] }) as unknown as SolicitudRow,
    );
    vi.mocked(repo.crearAlertaRevision).mockResolvedValue(undefined as never);
    const service = svc(repo);

    await service.reenviarObservacion(ID, "user-1", "cliente@example.com");

    expect(repo.marcarDocumentosReemplazadosPorIds).toHaveBeenCalledWith(ID, ["doc-obs"]);
    expect(repo.crearOActualizarRevision).toHaveBeenCalledWith(
      expect.objectContaining({ area: REVISION_AREAS.ASOCIADO, estado: RESULTADOS_APROBACION.PENDIENTE }),
    );
    expect(repo.crearAlertaRevision).toHaveBeenCalled();
  });
});

describe("SolicitudesApplicationService.uploadDocumento (ventanas del cliente)", () => {
  function detalleReserva(overrides: Record<string, unknown> = {}) {
    return {
      userId: "user-1",
      email: "cliente@example.com",
      standCode: "106",
      standCodes: ["106"],
      estadoSolicitud: ESTADOS_SOLICITUD.PENDIENTE,
      docsAdminCount: 1,
      clienteDocsAdjuntosCount: 0,
      reevaluaciones: [],
      revisiones: [],
      sgcEnabled: false,
      sgcEstadoEnvio: null,
      sgcLifecycleStatus: null,
      sgcDocumentosEnviados: false,
      sgcSubsanacionModo: null,
      sgcSubsanacionMotivo: null,
      docsAdjuntos: [
        {
          id: "contrato-1",
          userId: null,
          categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
          requisito: null,
          estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
          createdAt: "2026-10-18T21:43:23.400Z",
        },
      ],
      ...overrides,
    } as unknown as SolicitudRow;
  }

  const base = {
    solicitudId: ID,
    nombre: "anexo.pdf",
    userSub: "user-1",
    userEmail: "cliente@example.com",
    userPermissions: [],
  };

  it("adjunta un anexo durante la ventana de contrato de reserva", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(detalleReserva());
    const service = svc(repo);

    await service.uploadDocumento({
      ...base,
      url: "/uploads/anexo.pdf",
      tipo: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
      requisito: "ficha-ruc",
    });

    expect(repo.crearDocumentoAdjunto).toHaveBeenCalledWith(
      ID,
      "/uploads/anexo.pdf",
      "anexo.pdf",
      "user-1",
      "cliente@example.com",
      TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
      "ficha-ruc",
      null,
    );
    expect(repo.marcarDocumentosReemplazados).toHaveBeenCalledWith(
      ID,
      "user-1",
      TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
      "ficha-ruc",
    );
  });

  it("adjunta el contrato firmado en la misma ventana", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(detalleReserva());
    const service = svc(repo);

    await service.uploadDocumento({
      ...base,
      url: "/uploads/firmado.pdf",
      tipo: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
      firmaDigital: true,
    });

    expect(repo.crearDocumentoAdjunto).toHaveBeenCalledWith(
      ID,
      "/uploads/firmado.pdf",
      "anexo.pdf",
      "user-1",
      "cliente@example.com",
      TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
      null,
      null,
    );
  });

  it("rechaza subir manualmente el contrato firmado cuando la firma es digital", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(detalleReserva());
    const service = svc(repo);

    await expect(
      service.uploadDocumento({
        ...base,
        url: "/uploads/firmado.pdf",
        tipo: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(repo.crearDocumentoAdjunto).not.toHaveBeenCalled();
  });

  it("acepta el contrato firmado generado por la firma digital", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(detalleReserva());
    const service = svc(repo);

    await service.uploadDocumento({
      ...base,
      url: "/uploads/firmado-digital.pdf",
      tipo: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
      firmaDigital: true,
    });

    expect(repo.crearDocumentoAdjunto).toHaveBeenCalled();
  });

  it("permite anexos cuando la solicitud fue observada", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(
      detalleObservado({ revisiones: [], reevaluaciones: [], standCodes: ["A-1"] }) as unknown as SolicitudRow,
    );
    const service = svc(repo);

    await service.uploadDocumento({
      ...base,
      url: "/uploads/anexo.pdf",
      tipo: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
      requisito: "ficha-ruc",
    });

    expect(repo.crearDocumentoAdjunto).toHaveBeenCalledTimes(1);
  });

  it("rechaza un anexo con formato no permitido para su requisito", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(detalleReserva());
    const service = svc(repo);

    await expect(
      service.uploadDocumento({
        ...base,
        url: "/uploads/ficha-ruc.png",
        tipo: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
        requisito: "ficha-ruc",
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repo.crearDocumentoAdjunto).not.toHaveBeenCalled();
  });

  it("rechaza subir documentos a una solicitud ajena", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(detalleReserva());
    const service = svc(repo);

    await expect(
      service.uploadDocumento({
        ...base,
        userSub: "otro",
        url: "/uploads/anexo.pdf",
        tipo: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
        requisito: "ficha-ruc",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(repo.crearDocumentoAdjunto).not.toHaveBeenCalled();
  });

  it("rechaza subir si la solicitud no esta en una ventana habilitada", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(detalleReserva({ docsAdminCount: 0, docsAdjuntos: [] }));
    const service = svc(repo);

    await expect(
      service.uploadDocumento({
        ...base,
        url: "/uploads/anexo.pdf",
        tipo: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
        requisito: "ficha-ruc",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(repo.crearDocumentoAdjunto).not.toHaveBeenCalled();
  });

  it("permite anexos iniciales de una reserva sin contrato cuando el flujo lo indica", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(detalleReserva({ docsAdminCount: 0, docsAdjuntos: [] }));
    const service = svc(repo);

    await expect(
      service.uploadDocumento({
        ...base,
        url: "/uploads/anexo.pdf",
        tipo: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
        requisito: "ficha-ruc",
        permitirAnexosIniciales: true,
      }),
    ).resolves.toBeUndefined();
    expect(repo.crearDocumentoAdjunto).toHaveBeenCalled();
  });
});

describe("reenviarObservacion con contrato del administrador observado", () => {
  const baseDocs = [
    {
      id: "contrato-obs",
      nombre: "Contrato v1.pdf",
      url: "/uploads/contrato-v1.pdf",
      userId: null,
      categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
      requisito: null,
      estado: ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO,
      createdAt: "2026-10-16T10:00:00.000Z",
    },
    {
      id: "contrato-nuevo",
      nombre: "Contrato v2.pdf",
      url: "/uploads/contrato-v2.pdf",
      userId: null,
      categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
      requisito: null,
      estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
      createdAt: "2026-10-17T10:00:00.000Z",
    },
  ];

  it("exige firmar la version corregida del contrato", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(
      detalleObservado({
        revisiones: [],
        reevaluaciones: [],
        standCodes: ["A-1"],
        docsAdjuntos: [
          ...baseDocs,
          {
            id: "firmado-viejo",
            nombre: "firmado.pdf",
            url: "/uploads/firmado.pdf",
            userId: "user-1",
            categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
            requisito: null,
            estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
            createdAt: "2026-10-16T12:00:00.000Z",
          },
        ],
      }) as unknown as SolicitudRow,
    );
    const service = svc(repo);

    await expect(service.reenviarObservacion(ID, "user-1", "cliente@example.com")).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("Contrato firmado"),
    });
    expect(repo.marcarDocumentosReemplazadosPorIds).not.toHaveBeenCalled();
  });

  it("permite reenviar si el cliente firmo despues del contrato corregido", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(
      detalleObservado({
        revisiones: [],
        reevaluaciones: [],
        standCodes: ["A-1"],
        docsAdjuntos: [
          ...baseDocs,
          {
            id: "firmado-nuevo",
            nombre: "firmado-v2.pdf",
            url: "/uploads/firmado-v2.pdf",
            userId: "user-1",
            categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
            requisito: null,
            estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
            createdAt: "2026-10-17T12:00:00.000Z",
          },
        ],
      }) as unknown as SolicitudRow,
    );
    vi.mocked(repo.crearAlertaRevision).mockResolvedValue(undefined as never);
    const service = svc(repo);

    await service.reenviarObservacion(ID, "user-1", "cliente@example.com");

    expect(repo.marcarDocumentosReemplazadosPorIds).toHaveBeenCalledWith(ID, ["contrato-obs"]);
    expect(repo.crearOActualizarRevision).toHaveBeenCalledWith(
      expect.objectContaining({ area: REVISION_AREAS.ASOCIADO, estado: RESULTADOS_APROBACION.PENDIENTE }),
    );
  });
});

describe("reenviarObservacion cuando el contrato observado ya fue regenerado", () => {
  it("permite reenviar con la version corregida ya firmada", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(
      detalleObservado({
        revisiones: [],
        reevaluaciones: [],
        standCodes: ["A-1"],
        docsAdjuntos: [
          {
            id: "contrato-observado",
            nombre: "Contrato v1.pdf",
            url: "/uploads/contrato-v1.pdf",
            userId: null,
            categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
            requisito: null,
            motivoObservacion: "contrato errado",
            estado: ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO,
            createdAt: "2026-10-16T10:00:00.000Z",
          },
          {
            id: "contrato-corregido",
            nombre: "Contrato v2.pdf",
            url: "/uploads/contrato-v2.pdf",
            userId: null,
            categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
            requisito: null,
            estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
            createdAt: "2026-10-17T10:00:00.000Z",
          },
          {
            id: "firmado-corregido",
            nombre: "firmado-v2.pdf",
            url: "/uploads/firmado-v2.pdf",
            userId: "user-1",
            categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
            requisito: null,
            estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
            createdAt: "2026-10-17T12:00:00.000Z",
          },
        ],
      }) as unknown as SolicitudRow,
    );
    vi.mocked(repo.crearAlertaRevision).mockResolvedValue(undefined as never);
    const service = svc(repo);

    await service.reenviarObservacion(ID, "user-1", "cliente@example.com");

    expect(repo.marcarDocumentosReemplazadosPorIds).toHaveBeenCalledWith(ID, ["contrato-observado"]);
    expect(repo.crearOActualizarRevision).toHaveBeenCalledWith(
      expect.objectContaining({ area: REVISION_AREAS.ASOCIADO, estado: RESULTADOS_APROBACION.PENDIENTE }),
    );
  });
});

describe("eliminarDocumento: solo la iteracion actual", () => {
  const doc = {
    id: "doc-1",
    userId: "user-1",
    solicitudId: ID,
    createdAt: new Date("2026-10-19T00:00:00.000Z"),
    estado: "activo",
    flgActivo: true,
  };

  it("bloquea documentos subidos antes de la ultima revision", async () => {
    const repo = repoMock();
    vi.mocked(repo.findDocumento).mockResolvedValue(doc);
    vi.mocked(repo.detalle).mockResolvedValue(
      detalleObservado({ revisiones: [{ updatedAt: "2026-10-19T01:00:00.000Z" }] }) as unknown as SolicitudRow,
    );
    const service = svc(repo);

    await expect(
      service.eliminarDocumento({ docId: "doc-1", userSub: "user-1", userPermissions: [] }),
    ).rejects.toMatchObject({ status: 409 });
    expect(repo.eliminarDocumento).not.toHaveBeenCalled();
  });

  it("permite eliminar el documento subido despues de la ultima revision", async () => {
    const repo = repoMock();
    vi.mocked(repo.findDocumento).mockResolvedValue(doc);
    vi.mocked(repo.detalle).mockResolvedValue(
      detalleObservado({ revisiones: [{ updatedAt: "2026-10-18T23:00:00.000Z" }] }) as unknown as SolicitudRow,
    );
    const service = svc(repo);

    await service.eliminarDocumento({ docId: "doc-1", userSub: "user-1", userPermissions: [] });

    expect(repo.eliminarDocumento).toHaveBeenCalledWith("doc-1");
  });
});

describe("revisar: solo documentos del cliente", () => {
  it("rechaza observar el contrato del administrador", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(
      detalleObservado({
        docsAdjuntos: [{
          id: "contrato-admin",
          nombre: "contrato.pdf",
          url: "/uploads/contrato.pdf",
          userId: null,
          categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
          requisito: null,
          estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
          createdAt: "2026-10-19T00:00:00.000Z",
        }],
      }) as unknown as SolicitudRow,
    );
    const service = svc(repo);

    await expect(
      service.revisar({
        solicitudId: ID,
        area: REVISION_AREAS.ASOCIADO,
        estado: RESULTADOS_APROBACION.OBSERVADO,
        comentario: "contrato errado",
        documentosObservados: ["contrato-admin"],
        reviewerEmail: "rev@iimp.org",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(repo.observarDocumentos).not.toHaveBeenCalled();
  });
});

describe("SolicitudesApplicationService.habilitarContrato", () => {
  it("solo enciende el habilitador sin tocar el flujo ni generar documentos", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue({
      userId: "user-1",
      estadoSolicitud: ESTADOS_SOLICITUD.PENDIENTE,
      contratoHabilitado: false,
    } as unknown as SolicitudRow);
    const service = svc(repo);

    await service.habilitarContrato(ID);

    expect(repo.habilitarContrato).toHaveBeenCalledWith(ID);
    expect(repo.crearOActualizarRevision).not.toHaveBeenCalled();
    expect(repo.crearDocumentoAdjunto).not.toHaveBeenCalled();
    expect(repo.guardarPlanCuotas).not.toHaveBeenCalled();
  });

  it("no habilita una solicitud que ya no esta pendiente", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue({
      userId: "user-1",
      estadoSolicitud: ESTADOS_SOLICITUD.OBSERVADO,
    } as unknown as SolicitudRow);
    const service = svc(repo);

    await expect(service.habilitarContrato(ID)).rejects.toMatchObject({ status: 409 });
    expect(repo.habilitarContrato).not.toHaveBeenCalled();
  });
});
