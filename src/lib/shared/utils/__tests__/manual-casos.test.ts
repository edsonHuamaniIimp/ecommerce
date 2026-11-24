import { describe, expect, it } from "vitest";
import {
  ESTADOS_DOCUMENTO_SOLICITUD,
  ESTADOS_SOLICITUD,
  MANUAL_CASOS,
  REVISION_AREAS,
  SGC_ESTADO_ENVIO,
  SGC_LIFECYCLE_STATUSES,
  TIPOS_DOCUMENTO_SOLICITUD,
} from "@/lib/shared/constants";
import { casosManualSolicitud, type SolicitudManualGate } from "../manual-casos";

const CLIENTE = "user-cliente";
const base: SolicitudManualGate = {
  estadoSolicitud: ESTADOS_SOLICITUD.APROBADO,
  standCodes: ["A-1"],
  userId: CLIENTE,
  docsAdminCount: 1,
  clienteDocsAdjuntosCount: 3,
  reevaluaciones: [],
  sgcEnabled: true,
  sgcEstadoEnvio: SGC_ESTADO_ENVIO.CREADO,
  sgcLifecycleStatus: "legal-review",
  sgcDocumentosEnviados: true,
  docsAdjuntos: [],
  revisiones: [{ area: REVISION_AREAS.ASOCIADO }],
  sgcObservaciones: [],
};
const devuelto: SolicitudManualGate = { ...base, estadoSolicitud: ESTADOS_SOLICITUD.OBSERVADO, sgcLifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED };
const obs = (extra: Record<string, unknown>) => ({
  observationId: "obs-1",
  message: "Corrige",
  status: "open",
  requiresDocumentChange: true,
  createdAt: "2026-11-23T15:00:00.000Z",
  ...extra,
});

describe("casosManualSolicitud", () => {
  it("en revision del area legal solo informa", () => {
    expect(casosManualSolicitud(base)).toEqual([MANUAL_CASOS.EN_REVISION]);
  });

  it("observacion de un documento del SGC", () => {
    const s = { ...devuelto, sgcObservaciones: [obs({ category: "annex", documentId: "d1", title: "Vigencia" })] };
    expect(casosManualSolicitud(s)).toEqual([MANUAL_CASOS.SGC_DOCUMENTOS]);
  });

  it("grupo de documentos con piezas y contrato observado", () => {
    const s = {
      ...devuelto,
      sgcObservaciones: [
        obs({ observationId: "c", category: "contract", documentId: "k", title: "Contrato" }),
        obs({ observationId: "g", category: "annex", documentId: null, title: "Se solicita documentos", pieces: [{ id: "p1", title: "DNI" }] }),
      ],
    };
    expect(casosManualSolicitud(s)).toEqual([MANUAL_CASOS.SGC_CONTRATO, MANUAL_CASOS.SGC_GRUPO]);
  });

  it("devolucion sin marcar documentos", () => {
    const s = { ...devuelto, sgcObservaciones: [obs({ observationId: "devolucion-sin-obs-v5", category: "contract", documentId: "k" })] };
    expect(casosManualSolicitud(s)).toEqual([MANUAL_CASOS.SGC_SIN_DETALLE]);
  });

  it("todo corregido: falta solicitar la nueva revision", () => {
    const s = {
      ...devuelto,
      sgcObservaciones: [obs({ category: "annex", documentId: "d1", title: "Vigencia" })],
      docsAdjuntos: [{ id: "n", userId: CLIENTE, categoria: TIPOS_DOCUMENTO_SOLICITUD.ANEXO, estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO, sgcObservationId: "obs-1", createdAt: "2026-11-24T10:00:00.000Z" }],
    };
    expect(casosManualSolicitud(s)).toEqual([MANUAL_CASOS.SGC_REENVIAR]);
  });

  it("observacion del Asociado: documentos y contrato", () => {
    const s: SolicitudManualGate = {
      ...base,
      estadoSolicitud: ESTADOS_SOLICITUD.OBSERVADO,
      sgcEstadoEnvio: null,
      sgcLifecycleStatus: null,
      docsAdjuntos: [
        { id: "a", userId: CLIENTE, categoria: TIPOS_DOCUMENTO_SOLICITUD.ANEXO, estado: ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO, createdAt: "2026-11-10T00:00:00.000Z" },
        { id: "c", userId: CLIENTE, categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO, estado: ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO, createdAt: "2026-11-10T00:00:00.000Z" },
      ],
    };
    expect(casosManualSolicitud(s)).toEqual([MANUAL_CASOS.ASOCIADO_CONTRATO, MANUAL_CASOS.ASOCIADO_DOCUMENTOS]);
  });

  it("pendiente de pago", () => {
    const s = { ...base, sgcLifecycleStatus: SGC_LIFECYCLE_STATUSES.ACTIVE, estadoPago: "pendiente_pago" };
    expect(casosManualSolicitud(s)).toEqual([MANUAL_CASOS.PAGO]);
  });

  it("sin accion pendiente no devuelve casos", () => {
    expect(casosManualSolicitud({ ...base, sgcLifecycleStatus: SGC_LIFECYCLE_STATUSES.FINALIZED })).toEqual([]);
  });
});
