import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {},
}));
vi.mock("@/lib/server/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  buildReservaConfirmationEmail: vi.fn(() => ({ subject: "s", html: "h" })),
  buildAdminNotificacionEmail: vi.fn(() => ({ subject: "s", html: "h" })),
}));

import { SgcIntegracionApplicationService } from "../sgc-integracion-service";
import { SgcWebhookApplicationService } from "../sgc-webhook-service";
import { SolicitudesApplicationService } from "@/application/solicitudes/solicitudes-service";
import { ReservaApplicationService } from "@/application/reservas/reserva-service";
import { SgcClientMock, resetSgcClientMock } from "@/infrastructure/external/sgc-client.mock";
import type {
  ActualizarSgcDocumentoData,
  ActualizarSgcExpedienteData,
  CrearSgcDocumentoData,
  CrearSgcExpedienteData,
  ISgcRepository,
} from "@/domain/ports/sgc-repository";
import type { ISgcWebhookRepository } from "@/domain/ports/sgc-webhook-repository";
import type { IDocumentoOrigen } from "@/domain/ports/documento-origen";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IGessRepository } from "@/domain/ports/gess-repository";
import type {
  RevisionEntity,
  SolicitudRow,
} from "@/domain/models/entities";
import type {
  SgcDocumentoEntity,
  SgcExpedienteEntity,
  SgcWebhookEventoEntity,
  SgcWebhookPayload,
} from "@/domain/models/sgc";
import {
  REVISION_AREAS,
  RESULTADOS_APROBACION,
  SGC_DOCUMENT_CATEGORIES,
  SGC_DOCUMENTO_ESTADO,
  SGC_ESTADO_ENVIO,
  SGC_EVENT_TYPES,
  SGC_LIFECYCLE_STATUSES,
  SGC_STAGES,
} from "@/lib/shared/constants";

/**
 * Prueba de flujo completo (happy path) que comienza con la CREACIÓN de la solicitud:
 *   ReservaApplicationService.crear → revisión Logística → revisión Comunicación
 *   → se delega al SGC (la revisión Legal pasa a ser el internal-review del SGC)
 *   → carga de contrato/anexos (3 fases) → detalle → webhooks → descarga del firmado.
 */

const SOLICITUD_ID = "11111111-1111-4111-8111-111111111111";
const STAND_CODE = "STAND-2026-0042";
const EMPRESA = "Expositor S.A.C.";
const PDF_BYTES = new Uint8Array([37, 80, 68, 70, 45, 49]); // %PDF-1
const CONFIG = { enabled: true, areaCode: "EVENTOS", contractTypeCode: "AUSPICIO" };

/* --------------------------- Repositorios en memoria --------------------------- */

class InMemorySolicitudesRepository {
  private estado = "pendiente";
  private readonly revisiones = new Map<string, RevisionEntity>();

  constructor(
    private readonly solicitudId: string,
    private readonly standCode: string,
    private readonly empresa: string,
  ) {}

  async crearSolicitud(): Promise<string> {
    return this.solicitudId;
  }

  async crearRevisionInicial(_solicitudId: string, area: string): Promise<RevisionEntity> {
    const rev = this.revision(area, RESULTADOS_APROBACION.PENDIENTE, true);
    this.revisiones.set(area, rev);
    return rev;
  }

  async crearOActualizarRevision(data: { area: string; estado: string }): Promise<RevisionEntity> {
    const prev = this.revisiones.get(data.area);
    const rev = this.revision(data.area, data.estado, prev?.estado === RESULTADOS_APROBACION.PENDIENTE);
    this.revisiones.set(data.area, rev);
    this.estado = this.calcularEstado();
    return rev;
  }

  async detalle(): Promise<SolicitudRow> {
    return {
      id: this.solicitudId,
      gessStandId: "gess-1",
      standCode: this.standCode,
      standCodes: [this.standCode],
      tipoStand: "PREFERENCIAL",
      medidas: "3000.00 US$",
      empresa: this.empresa,
      email: "contacto@expositor.pe",
      userId: "user-1",
      bloqueId: "EXT-IZQ-01",
      estado: "en_evaluacion",
      estadoSolicitud: this.estado,
      flgActivo: true,
      documentos: [],
      imagenes: [],
      docsAdjuntosCount: 2,
      clienteDocsAdjuntosCount: 1,
      docsAdjuntos: [
        { id: "d0", url: "/uploads/contrato-v1.pdf", nombre: "Contrato de separacion de stand v1", userId: null, uploadedBy: "admin@iimp.org.pe", createdAt: new Date() },
        { id: "d1", url: "/uploads/anexo-1.pdf", nombre: "anexo-1.pdf", userId: "user-1", uploadedBy: "contacto@expositor.pe", createdAt: new Date() },
      ],
      updatedAt: new Date("2026-09-15T00:00:00.000Z"),
      revisiones: [...this.revisiones.values()],
      reevaluaciones: [],
      revisionComunicacion: this.revisiones.get(REVISION_AREAS.COMUNICACION) ?? null,
      revisionLegal: this.revisiones.get(REVISION_AREAS.LEGAL) ?? null,
      revisionLogistica: this.revisiones.get(REVISION_AREAS.LOGISTICA) ?? null,
      tieneFacturacion: false,
      tipoFacturacion: null,
      facturacionId: null,
      sgcEstadoEnvio: null,
      sgcLifecycleStatus: null,
      sgcStage: null,
      sgcDocumentosEnviados: false,
      sgcEnabled: true,
    };
  }

  async crearAlertaRevision(): Promise<void> {}
  async crearAlertaReserva(): Promise<void> {}

  private calcularEstado(): string {
    const revs = [...this.revisiones.values()];
    if (revs.length === 0) return "pendiente";
    if (revs.every((r) => r.estado === RESULTADOS_APROBACION.PENDIENTE)) return "pendiente";
    return "en_proceso";
  }

  private revision(area: string, estado: string, fuePrimeraRevision: boolean): RevisionEntity {
    const ahora = new Date("2026-09-15T00:00:00.000Z");
    return {
      id: `rev-${area}`,
      solicitudId: this.solicitudId,
      area,
      estado,
      comentario: null,
      createdBy: null,
      updatedBy: null,
      createdAt: ahora,
      updatedAt: ahora,
      fuePrimeraRevision,
    };
  }
}

class InMemorySgcRepository implements ISgcRepository {
  private readonly expedientes = new Map<string, SgcExpedienteEntity>();
  readonly documentos = new Map<string, SgcDocumentoEntity>();
  private seq = 0;

  private byId(id: string): SgcExpedienteEntity | undefined {
    return [...this.expedientes.values()].find((e) => e.id === id);
  }

  async findExpedientePorSolicitud(solicitudId: string): Promise<SgcExpedienteEntity | null> {
    return this.expedientes.get(solicitudId) ?? null;
  }

  async findExpedientePorContractId(contractId: string): Promise<SgcExpedienteEntity | null> {
    return [...this.expedientes.values()].find((e) => e.contractId === contractId) ?? null;
  }

  async listarConContractId(): Promise<SgcExpedienteEntity[]> {
    return [...this.expedientes.values()].filter((e) => e.contractId !== null);
  }

  async listarConEstadoEnvio(estado: string): Promise<SgcExpedienteEntity[]> {
    return [...this.expedientes.values()].filter((e) => e.estadoEnvio === estado);
  }

  async crearExpediente(data: CrearSgcExpedienteData): Promise<SgcExpedienteEntity> {
    this.seq += 1;
    const entity: SgcExpedienteEntity = {
      id: `exp-${this.seq}`,
      solicitudId: data.solicitudId,
      code: data.code,
      contractId: null,
      estadoEnvio: SGC_ESTADO_ENVIO.PENDIENTE,
      stage: null,
      lifecycleStatus: null,
      version: null,
      areaCode: data.areaCode,
      contractTypeCode: data.contractTypeCode,
      lastSyncedAt: null,
      lastError: null,
    };
    this.expedientes.set(data.solicitudId, entity);
    return entity;
  }

  async actualizarExpediente(id: string, data: ActualizarSgcExpedienteData): Promise<SgcExpedienteEntity> {
    const actual = this.byId(id);
    if (!actual) throw new Error(`Expediente ${id} no existe`);
    const updated: SgcExpedienteEntity = { ...actual, ...data };
    this.expedientes.set(actual.solicitudId, updated);
    return updated;
  }

  async crearDocumento(data: CrearSgcDocumentoData): Promise<SgcDocumentoEntity> {
    this.seq += 1;
    const entity: SgcDocumentoEntity = {
      id: `doc-${this.seq}`,
      sgcExpedienteId: data.sgcExpedienteId,
      documentId: data.documentId,
      currentVersionId: null,
      category: data.category,
      title: data.title,
      fileName: data.fileName,
      checksumSha256: data.checksumSha256,
      sizeBytes: data.sizeBytes,
      estado: SGC_DOCUMENTO_ESTADO.RESERVADO,
    };
    this.documentos.set(data.documentId, entity);
    return entity;
  }

  async actualizarDocumento(documentId: string, data: ActualizarSgcDocumentoData): Promise<void> {
    const actual = this.documentos.get(documentId);
    if (actual) this.documentos.set(documentId, { ...actual, ...data });
  }
}

class InMemoryWebhookRepository implements ISgcWebhookRepository {
  private readonly eventos = new Map<string, SgcWebhookEventoEntity>();
  private seq = 0;

  async findEvento(eventId: string): Promise<SgcWebhookEventoEntity | null> {
    return this.eventos.get(eventId) ?? null;
  }

  async registrarEvento(data: { eventId: string; eventType: string; resourceId: string | null; resourceCode: string | null }): Promise<SgcWebhookEventoEntity> {
    this.seq += 1;
    const entity: SgcWebhookEventoEntity = {
      id: `wh-${this.seq}`,
      eventId: data.eventId,
      eventType: data.eventType,
      resourceId: data.resourceId,
      resourceCode: data.resourceCode,
      procesadoAt: null,
      error: null,
    };
    this.eventos.set(data.eventId, entity);
    return entity;
  }

  async marcarProcesado(eventId: string, error: string | null): Promise<void> {
    const actual = this.eventos.get(eventId);
    if (actual) this.eventos.set(eventId, { ...actual, procesadoAt: new Date(), error });
  }
}

/* --------------------------------- Set up --------------------------------- */

function setup() {
  const solicitudRepo = new InMemorySolicitudesRepository(SOLICITUD_ID, STAND_CODE, EMPRESA);
  const gessRepo = {
    findById: vi.fn().mockResolvedValue({ id: "gess-1", standCode: STAND_CODE, estado: "disponible", empresa: EMPRESA }),
    update: vi.fn().mockResolvedValue(undefined),
  } as unknown as IGessRepository;

  const sgcRepo = new InMemorySgcRepository();
  const webhookRepo = new InMemoryWebhookRepository();
  const client = new SgcClientMock();
  const documentoOrigen: IDocumentoOrigen = {
    leer: vi.fn().mockResolvedValue({ bytes: PDF_BYTES, mimeType: "application/pdf", fileName: "documento.pdf" }),
  };

  const sgc = new SgcIntegracionApplicationService(solicitudRepo as unknown as ISolicitudesRepository, sgcRepo, client, documentoOrigen, CONFIG);
  const webhook = new SgcWebhookApplicationService(webhookRepo, sgcRepo, CONFIG);
  const solicitudes = new SolicitudesApplicationService(solicitudRepo as unknown as ISolicitudesRepository, sgc);
  const reserva = new ReservaApplicationService(gessRepo, solicitudRepo as unknown as ISolicitudesRepository);

  return { solicitudRepo, gessRepo, sgcRepo, webhookRepo, client, sgc, webhook, solicitudes, reserva };
}

function webhookPayload(eventId: string, eventType: string, contractId: string, data: Record<string, unknown>): SgcWebhookPayload {
  return {
    apiVersion: "2026-09-01",
    eventId,
    eventType,
    createdAt: "2026-09-15T14:32:00.000Z",
    resource: { id: contractId, type: "contract", code: STAND_CODE },
    data,
  };
}

/* ----------------------------------- Tests ----------------------------------- */

beforeEach(() => {
  resetSgcClientMock();
});

describe("Flujo completo SGC (happy path desde la solicitud)", () => {
  it("deberia ir de la creacion de la solicitud a la descarga del contrato firmado", async () => {
    const { sgcRepo, sgc, webhook, solicitudes, reserva } = setup();

    /* 1. Cliente crea la solicitud (ReservaApplicationService) -> 3 revisiones pendientes */
    const creada = await reserva.crear({
      standIds: ["gess-1"],
      datos: { razonSocial: EMPRESA, tipoDocumento: "RUC", numeroDocumento: "20123456789", email: "contacto@expositor.pe" },
      userEmail: "contacto@expositor.pe",
      userSub: "user-1",
    });
    expect(creada.ok).toBe(true);
    const inicial = await solicitudes.detalle(SOLICITUD_ID);
    // Legal ya no es local: solo se crean revisiones de Logistica y Comunicacion.
    expect(inicial?.revisiones).toHaveLength(2);
    expect(inicial?.revisiones.every((r) => r.estado === RESULTADOS_APROBACION.PENDIENTE)).toBe(true);

    /* 2. Revisión Logística (local) */
    await solicitudes.revisar({ solicitudId: SOLICITUD_ID, area: REVISION_AREAS.LOGISTICA, estado: RESULTADOS_APROBACION.APROBADO, reviewerEmail: "logistica@iimp.org.pe" });
    expect(await sgcRepo.findExpedientePorSolicitud(SOLICITUD_ID)).toBeNull();

    /* 3. Revisión Comunicación (local, última) -> se DELEGA al SGC */
    const crearSpy = vi.spyOn(SgcClientMock.prototype, "crearExpediente");
    await solicitudes.revisar({ solicitudId: SOLICITUD_ID, area: REVISION_AREAS.COMUNICACION, estado: RESULTADOS_APROBACION.APROBADO, reviewerEmail: "comunicacion@iimp.org.pe" });

    const expediente = await sgcRepo.findExpedientePorSolicitud(SOLICITUD_ID);
    expect(crearSpy).toHaveBeenCalledTimes(1);
    expect(expediente?.estadoEnvio).toBe(SGC_ESTADO_ENVIO.CREADO);
    expect(expediente?.code).toBe(STAND_CODE);
    const contractId = expediente?.contractId ?? "";
    expect(contractId).toBeTruthy();

    /* 4. Idempotencia: reintentar el disparo no crea otro expediente */
    const reintento = await sgc.crearExpedienteDesdeSolicitud(SOLICITUD_ID);
    expect(reintento?.contractId).toBe(contractId);
    expect(crearSpy).toHaveBeenCalledTimes(1);

    /* 5. Carga del contrato v1 (3 fases con checksum) */
    const contrato = await sgc.subirDocumentoDesdeUrl(SOLICITUD_ID, {
      category: SGC_DOCUMENT_CATEGORIES.CONTRACT,
      title: "Contrato de separacion de stand v1",
      url: "/uploads/contrato-v1.pdf",
    });
    expect(contrato?.estado).toBe(SGC_DOCUMENTO_ESTADO.CONFIRMADO);
    expect(contrato?.currentVersionId).toBeTruthy();

    /* 6. Anexos de la solicitud */
    const anexos = await sgc.subirAnexosDeSolicitud(SOLICITUD_ID);
    expect(anexos).toHaveLength(1);
    expect(anexos[0]?.category).toBe(SGC_DOCUMENT_CATEGORIES.ANNEX);

    /* 7. Detalle para el sidebar (stepper + historial + documentos) */
    const detalle = await sgc.consultarExpediente(SOLICITUD_ID);
    expect(detalle?.code).toBe(STAND_CODE);
    expect(detalle?.documents.some((d) => d.category === SGC_DOCUMENT_CATEGORIES.CONTRACT)).toBe(true);

    /* 8. Webhook: el SGC avanza el flujo */
    const avanzado = await webhook.procesar(webhookPayload("evt-1", SGC_EVENT_TYPES.WORKFLOW_ADVANCED, contractId, { from: SGC_STAGES.INTERNAL_REVIEW, to: SGC_STAGES.APPROVAL, round: 1 }));
    expect(avanzado.duplicado).toBe(false);
    expect((await sgcRepo.findExpedientePorSolicitud(SOLICITUD_ID))?.stage).toBe(SGC_STAGES.APPROVAL);

    /* 9. Webhook duplicado: idempotencia por eventId */
    const duplicado = await webhook.procesar(webhookPayload("evt-1", SGC_EVENT_TYPES.WORKFLOW_ADVANCED, contractId, { to: SGC_STAGES.APPROVAL }));
    expect(duplicado.duplicado).toBe(true);

    /* 10. Webhook: aprobación final -> contrato VIGENTE */
    await webhook.procesar(webhookPayload("evt-2", SGC_EVENT_TYPES.WORKFLOW_APPROVED, contractId, { finalization: "active", documentVersionId: contrato?.currentVersionId }));
    expect((await sgcRepo.findExpedientePorSolicitud(SOLICITUD_ID))?.lifecycleStatus).toBe(SGC_LIFECYCLE_STATUSES.ACTIVE);

    /* 11. Descarga del contrato firmado (enlace de vida corta) */
    const enlace = await sgc.obtenerDescargaContrato(SOLICITUD_ID);
    expect(enlace?.url).toContain("/download/");
    expect(enlace?.expiresInSeconds).toBeGreaterThan(0);

    /* 12. Cierre formal */
    await webhook.procesar(webhookPayload("evt-3", SGC_EVENT_TYPES.CONTRACT_CLOSED, contractId, { cause: "finalizado" }));
    expect((await sgcRepo.findExpedientePorSolicitud(SOLICITUD_ID))?.lifecycleStatus).toBe(SGC_LIFECYCLE_STATUSES.FINALIZED);
  });

  it("deberia marcar Observado y permitir subsanar cuando el SGC devuelve el tramite", async () => {
    const { sgcRepo, sgc, webhook, solicitudes, reserva } = setup();
    await reserva.crear({ standIds: ["gess-1"], userEmail: "contacto@expositor.pe", userSub: "user-1" });
    await solicitudes.revisar({ solicitudId: SOLICITUD_ID, area: REVISION_AREAS.LOGISTICA, estado: RESULTADOS_APROBACION.APROBADO, reviewerEmail: "logistica@iimp.org.pe" });
    await solicitudes.revisar({ solicitudId: SOLICITUD_ID, area: REVISION_AREAS.COMUNICACION, estado: RESULTADOS_APROBACION.APROBADO, reviewerEmail: "comunicacion@iimp.org.pe" });
    const contractId = (await sgcRepo.findExpedientePorSolicitud(SOLICITUD_ID))?.contractId ?? "";

    await webhook.procesar(webhookPayload("evt-ret", SGC_EVENT_TYPES.WORKFLOW_RETURNED, contractId, { reason: "Falta firma", round: 1 }));
    expect((await sgcRepo.findExpedientePorSolicitud(SOLICITUD_ID))?.lifecycleStatus).toBe(SGC_LIFECYCLE_STATUSES.OBSERVED);

    const contrato = await sgc.subirDocumentoDesdeUrl(SOLICITUD_ID, { category: SGC_DOCUMENT_CATEGORIES.CONTRACT, title: "Contrato v1", url: "/uploads/contrato-v1.pdf" });
    const reemplazo = await sgc.subsanarContrato(SOLICITUD_ID, { url: "/uploads/contrato-v2.pdf", title: "Contrato corregido", documentId: contrato?.documentId ?? "" });
    expect(reemplazo?.documentId).toBe(contrato?.documentId);
    expect(reemplazo?.estado).toBe(SGC_DOCUMENTO_ESTADO.CONFIRMADO);
  });
});
