import { describe, it, expect, vi } from "vitest";
import { SgcIntegracionApplicationService } from "../sgc-integracion-service";
import type { SgcIntegracionConfig } from "../sgc-integracion-service";
import type { CrearSgcDocumentoData, ISgcRepository } from "@/domain/ports/sgc-repository";
import type { ISgcClient } from "@/domain/ports/sgc-client";
import type { IDocumentoOrigen } from "@/domain/ports/documento-origen";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { SgcExpedienteEntity } from "@/domain/models/sgc";
import type { SolicitudRow } from "@/domain/models/entities";
import {
  SGC_APPROVAL_RESULT,
  SGC_DOCUMENT_CATEGORIES,
  SGC_DOCUMENTO_ESTADO,
  SGC_ESTADO_ENVIO,
  SGC_MOTIVO_CARGA_INICIAL,
} from "@/lib/shared/constants";
import { sha256Hex } from "@/lib/shared/utils/sgc";

const CONFIG: SgcIntegracionConfig = { enabled: true, areaCode: "EVENTOS", contractTypeCode: "AUSPICIO" };
const BYTES = new Uint8Array([1, 2, 3, 4]);

function expediente(): SgcExpedienteEntity {
  return {
    id: "exp-1",
    solicitudId: "sol-1",
    code: "STAND-1",
    contractId: "contract-1",
    estadoEnvio: SGC_ESTADO_ENVIO.CREADO,
    stage: null,
    lifecycleStatus: null,
    version: null,
    areaCode: "EVENTOS",
    contractTypeCode: "AUSPICIO",
    lastSyncedAt: null,
    lastError: null,
  };
}

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
    sgcEnabled: false,
    ...overrides,
  };
}

function sgcRepoMock(existente: SgcExpedienteEntity | null = expediente()): ISgcRepository {
  return {
    findExpedientePorSolicitud: vi.fn().mockResolvedValue(existente),
    findExpedientePorContractId: vi.fn().mockResolvedValue(null),
    listarConContractId: vi.fn().mockResolvedValue([]),
    listarConEstadoEnvio: vi.fn().mockResolvedValue([]),
    crearExpediente: vi.fn(),
    actualizarExpediente: vi.fn(),
    crearDocumento: vi.fn().mockImplementation((data: CrearSgcDocumentoData) =>
      Promise.resolve({ id: "doc-1", currentVersionId: null, estado: SGC_DOCUMENTO_ESTADO.RESERVADO, ...data }),
    ),
    actualizarDocumento: vi.fn().mockResolvedValue(undefined),
  };
}

function clientMock(outcome: string = SGC_APPROVAL_RESULT.ACCEPTED): ISgcClient {
  return {
    crearExpediente: vi.fn(),
    actualizarExpediente: vi.fn().mockResolvedValue(undefined),
    consultarExpediente: vi.fn(),
    listarExpedientes: vi.fn(),
    reservarSubida: vi.fn().mockResolvedValue({
      uploadUrl: "https://sgc/upload/1",
      headers: { "content-type": "application/pdf" },
      documentId: "document-1",
      versionId: "version-1",
      versionNumber: 1,
      expiresInSeconds: 300,
    }),
    transferirArchivo: vi.fn().mockResolvedValue(undefined),
    confirmarSubida: vi.fn().mockResolvedValue({ outcome }),
    consultarDocumento: vi.fn(),
    resolverVersion: vi.fn(),
    obtenerUrlDescarga: vi.fn(),
  };
}

function documentoOrigenMock(): IDocumentoOrigen {
  return {
    leer: vi.fn().mockResolvedValue({ bytes: BYTES, mimeType: "application/pdf", fileName: "contrato.pdf" }),
  };
}

function solicitudRepoMock(row: SolicitudRow | null = detalle()): ISolicitudesRepository {
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
  };
}

function build(repo: ISgcRepository, client: ISgcClient, origen: IDocumentoOrigen, solicitudRepo: ISolicitudesRepository) {
  return new SgcIntegracionApplicationService(solicitudRepo, repo, client, origen, CONFIG);
}

describe("SgcIntegracionApplicationService.subirPiezaDocumental", () => {
  it("deberia reservar, transferir y confirmar una pieza nueva", async () => {
    const repo = sgcRepoMock();
    const client = clientMock();
    const svc = build(repo, client, documentoOrigenMock(), solicitudRepoMock());

    const doc = await svc.subirPiezaDocumental("sol-1", {
      category: SGC_DOCUMENT_CATEGORIES.CONTRACT,
      title: "Contrato v1",
      fileName: "contrato.pdf",
      mimeType: "application/pdf",
      bytes: BYTES,
    });

    expect(client.reservarSubida).toHaveBeenCalledWith(
      "contract-1",
      expect.objectContaining({ checksumSha256: await sha256Hex(BYTES), declaredMimeType: "application/pdf" }),
    );
    expect(client.transferirArchivo).toHaveBeenCalledWith("https://sgc/upload/1", { "content-type": "application/pdf" }, BYTES);
    expect(client.confirmarSubida).toHaveBeenCalledWith("version-1");
    expect(repo.crearDocumento).toHaveBeenCalled();
    expect(repo.actualizarDocumento).toHaveBeenCalledWith(
      "document-1",
      expect.objectContaining({ estado: SGC_DOCUMENTO_ESTADO.CONFIRMADO, currentVersionId: "version-1" }),
    );
    expect(doc?.estado).toBe(SGC_DOCUMENTO_ESTADO.CONFIRMADO);
  });

  it("deberia marcar la version como rechazada sin lanzar", async () => {
    const svc = build(sgcRepoMock(), clientMock(SGC_APPROVAL_RESULT.REJECTED), documentoOrigenMock(), solicitudRepoMock());

    const doc = await svc.subirPiezaDocumental("sol-1", {
      category: SGC_DOCUMENT_CATEGORIES.CONTRACT,
      title: "Contrato v1",
      fileName: "contrato.pdf",
      mimeType: "application/pdf",
      bytes: BYTES,
    });

    expect(doc?.estado).toBe(SGC_DOCUMENTO_ESTADO.RECHAZADO);
  });

  it("deberia crear una version nueva sin crear otra pieza cuando recibe documentId", async () => {
    const repo = sgcRepoMock();
    const client = clientMock();
    const svc = build(repo, client, documentoOrigenMock(), solicitudRepoMock());

    await svc.subirPiezaDocumental("sol-1", {
      category: SGC_DOCUMENT_CATEGORIES.CONTRACT,
      title: "Contrato v2",
      fileName: "contrato-v2.pdf",
      mimeType: "application/pdf",
      bytes: BYTES,
      documentId: "document-1",
    });

    expect(repo.crearDocumento).not.toHaveBeenCalled();
    expect(repo.actualizarDocumento).toHaveBeenCalledWith("document-1", expect.objectContaining({ estado: SGC_DOCUMENTO_ESTADO.RESERVADO }));
  });

  it("deberia no hacer nada si la integracion esta deshabilitada", async () => {
    const repo = sgcRepoMock();
    const client = clientMock();
    const svc = new SgcIntegracionApplicationService(solicitudRepoMock(), repo, client, documentoOrigenMock(), { ...CONFIG, enabled: false });

    const doc = await svc.subirPiezaDocumental("sol-1", {
      category: SGC_DOCUMENT_CATEGORIES.CONTRACT,
      title: "x",
      fileName: "x.pdf",
      mimeType: "application/pdf",
      bytes: BYTES,
    });

    expect(doc).toBeNull();
    expect(client.reservarSubida).not.toHaveBeenCalled();
  });

  it("deberia no subir si el expediente aun no tiene contractId", async () => {
    const repo = sgcRepoMock({ ...expediente(), contractId: null });
    const client = clientMock();
    const svc = build(repo, client, documentoOrigenMock(), solicitudRepoMock());

    const doc = await svc.subirPiezaDocumental("sol-1", {
      category: SGC_DOCUMENT_CATEGORIES.CONTRACT,
      title: "x",
      fileName: "x.pdf",
      mimeType: "application/pdf",
      bytes: BYTES,
    });

    expect(doc).toBeNull();
    expect(client.reservarSubida).not.toHaveBeenCalled();
  });
});

describe("SgcIntegracionApplicationService.subirDocumentoDesdeUrl", () => {
  it("deberia leer el binario desde el origen y subirlo", async () => {
    const client = clientMock();
    const origen = documentoOrigenMock();
    const svc = build(sgcRepoMock(), client, origen, solicitudRepoMock());

    await svc.subirDocumentoDesdeUrl("sol-1", {
      category: SGC_DOCUMENT_CATEGORIES.ANNEX,
      title: "Anexo 1",
      url: "/uploads/anexo.pdf",
    });

    expect(origen.leer).toHaveBeenCalledWith("/uploads/anexo.pdf");
    expect(client.reservarSubida).toHaveBeenCalledWith(
      "contract-1",
      expect.objectContaining({
        declaredMimeType: "application/pdf",
        documentId: null,
        /* El SGC exige un replacementReason no vacio tambien en la carga inicial. */
        replacementReason: SGC_MOTIVO_CARGA_INICIAL,
      }),
    );
  });

  it("deberia conservar el replacementReason explicito (subsanacion)", async () => {
    const client = clientMock();
    const svc = build(sgcRepoMock(), client, documentoOrigenMock(), solicitudRepoMock());

    await svc.subsanarContrato("sol-1", {
      url: "/uploads/contrato-v2.pdf",
      title: "Contrato v2",
      documentId: "doc-1",
    });

    expect(client.reservarSubida).toHaveBeenCalledWith(
      "contract-1",
      expect.objectContaining({ documentId: "doc-1", replacementReason: expect.any(String) }),
    );
  });
});

describe("SgcIntegracionApplicationService.subirContratoDeSolicitud", () => {
  it("usa el documento legacy (columna documentos) cuando no hay docsAdjuntos", async () => {
    const client = clientMock();
    const origen = documentoOrigenMock();
    const row = detalle({ documentos: ["/uploads/legacy.pdf"], docsAdjuntos: [] });
    const svc = build(sgcRepoMock(), client, origen, solicitudRepoMock(row));

    const doc = await svc.subirContratoDeSolicitud("sol-1");

    expect(doc).not.toBeNull();
    expect(origen.leer).toHaveBeenCalledWith("/uploads/legacy.pdf");
    expect(client.reservarSubida).toHaveBeenCalledWith(
      "contract-1",
      expect.objectContaining({ category: SGC_DOCUMENT_CATEGORIES.CONTRACT }),
    );
  });
});

describe("SgcIntegracionApplicationService.subirAnexosDeSolicitud", () => {
  it("deberia empujar cada adjunto del cliente como anexo (con contrato del admin)", async () => {
    const client = clientMock();
    const row = detalle({
      userId: "user-1",
      docsAdjuntos: [
        { id: "d0", url: "/uploads/contrato.pdf", nombre: "contrato.pdf", userId: null, uploadedBy: "admin@iimp.org.pe", createdAt: new Date() },
        { id: "d1", url: "/uploads/a.pdf", nombre: "a.pdf", userId: "user-1", uploadedBy: null, createdAt: new Date() },
        { id: "d2", url: "/uploads/b.pdf", nombre: "b.pdf", userId: "user-1", uploadedBy: null, createdAt: new Date() },
      ],
    });
    const svc = build(sgcRepoMock(), client, documentoOrigenMock(), solicitudRepoMock(row));

    const docs = await svc.subirAnexosDeSolicitud("sol-1");

    expect(docs).toHaveLength(2);
    expect(client.reservarSubida).toHaveBeenCalledTimes(2);
    expect(client.reservarSubida).toHaveBeenCalledWith(
      "contract-1",
      expect.objectContaining({ category: SGC_DOCUMENT_CATEGORIES.ANNEX }),
    );
  });

  it("no repite como anexo un documento con el mismo nombre que el contrato", async () => {
    const client = clientMock();
    const row = detalle({
      userId: "user-1",
      docsAdjuntos: [
        { id: "d0", url: "/uploads/contrato.pdf", nombre: "a.pdf", userId: null, uploadedBy: "admin@iimp.org.pe", createdAt: new Date() },
        { id: "d1", url: "/uploads/a-otra-url.pdf", nombre: "a.pdf", userId: "user-1", uploadedBy: null, createdAt: new Date() },
        { id: "d2", url: "/uploads/b.pdf", nombre: "b.pdf", userId: "user-1", uploadedBy: null, createdAt: new Date() },
      ],
    });
    const svc = build(sgcRepoMock(), client, documentoOrigenMock(), solicitudRepoMock(row));

    /* El contrato del admin se llama "a.pdf"; el anexo "a.pdf" (otra URL) se excluye por nombre -> solo b.pdf */
    const docs = await svc.subirAnexosDeSolicitud("sol-1");

    expect(docs).toHaveLength(1);
  });

  it("deberia excluir el documento del admin (userId null) de los anexos", async () => {
    const client = clientMock();
    const row = detalle({
      userId: "user-1",
      docsAdjuntos: [
        { id: "admin", url: "/uploads/contrato.pdf", nombre: "contrato.pdf", userId: null, uploadedBy: "admin@iimp.org.pe", createdAt: new Date() },
        { id: "cli", url: "/uploads/evidencia.pdf", nombre: "evidencia.pdf", userId: "user-1", uploadedBy: "cli@x.pe", createdAt: new Date() },
      ],
    });
    const svc = build(sgcRepoMock(), client, documentoOrigenMock(), solicitudRepoMock(row));

    const docs = await svc.subirAnexosDeSolicitud("sol-1");

    expect(docs).toHaveLength(1);
    expect(client.reservarSubida).toHaveBeenCalledTimes(1);
  });
});

describe("SgcIntegracionApplicationService.subirContratoDeSolicitud", () => {
  it("deberia subir el documento del admin (userId null) como contrato", async () => {
    const client = clientMock();
    const origen = documentoOrigenMock();
    const row = detalle({
      userId: "user-1",
      docsAdjuntos: [
        { id: "admin", url: "/uploads/contrato.pdf", nombre: "contrato.pdf", userId: null, uploadedBy: "admin@iimp.org.pe", createdAt: new Date() },
        { id: "cli", url: "/uploads/evidencia.pdf", nombre: "evidencia.pdf", userId: "user-1", uploadedBy: "cli@x.pe", createdAt: new Date() },
      ],
    });
    const svc = build(sgcRepoMock(), client, origen, solicitudRepoMock(row));

    const doc = await svc.subirContratoDeSolicitud("sol-1");

    expect(origen.leer).toHaveBeenCalledWith("/uploads/contrato.pdf");
    expect(client.reservarSubida).toHaveBeenCalledWith(
      "contract-1",
      expect.objectContaining({ category: SGC_DOCUMENT_CATEGORIES.CONTRACT }),
    );
    expect(doc).not.toBeNull();
  });
});
