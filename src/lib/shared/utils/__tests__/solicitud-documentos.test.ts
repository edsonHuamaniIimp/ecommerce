import { describe, expect, it } from "vitest";
import { ESTADOS_REEVALUACION, ESTADOS_SOLICITUD, REVISION_AREAS, SGC_ESTADO_ENVIO } from "@/lib/shared/constants";
import {
  enVentanaLegalSgc,
  puedeClienteSubirDocumentos,
  requiereDocsReevaluacion,
} from "../solicitud-documentos";

const base = {
  estadoSolicitud: ESTADOS_SOLICITUD.PENDIENTE,
  standCodes: ["A-1", "A-2"],
  clienteDocsAdjuntosCount: 0,
  reevaluaciones: [] as Array<{ estado: string }>,
  sgcEnabled: true,
  sgcEstadoEnvio: SGC_ESTADO_ENVIO.CREADO as string | null,
  sgcDocumentosEnviados: false,
  revisiones: [{ area: REVISION_AREAS.LOGISTICA }, { area: REVISION_AREAS.COMUNICACION }],
};

describe("enVentanaLegalSgc", () => {
  it("permite subir cuando el expediente SGC existe y aun no se enviaron documentos", () => {
    expect(enVentanaLegalSgc(base)).toBe(true);
  });

  it("bloquea si la integracion SGC esta deshabilitada", () => {
    expect(enVentanaLegalSgc({ ...base, sgcEnabled: false })).toBe(false);
  });

  it("bloquea si aun no existe expediente SGC", () => {
    expect(enVentanaLegalSgc({ ...base, sgcEstadoEnvio: null })).toBe(false);
  });

  it("bloquea si ya se enviaron documentos al SGC", () => {
    expect(enVentanaLegalSgc({ ...base, sgcDocumentosEnviados: true })).toBe(false);
  });

  it("bloquea si la revision Legal sigue siendo local (legacy)", () => {
    expect(
      enVentanaLegalSgc({ ...base, revisiones: [...base.revisiones, { area: REVISION_AREAS.LEGAL }] }),
    ).toBe(false);
  });
});

describe("requiereDocsReevaluacion", () => {
  const rechazada = { ...base, estadoSolicitud: ESTADOS_SOLICITUD.RECHAZADO };

  it("aplica a reserva multiple rechazada sin documentos del cliente", () => {
    expect(requiereDocsReevaluacion(rechazada)).toBe(true);
  });

  it("no aplica a reserva simple", () => {
    expect(requiereDocsReevaluacion({ ...rechazada, standCodes: ["A-1"] })).toBe(false);
  });

  it("no aplica si el cliente ya adjunto documentos", () => {
    expect(requiereDocsReevaluacion({ ...rechazada, clienteDocsAdjuntosCount: 1 })).toBe(false);
  });

  it("no aplica si hay una re-evaluacion pendiente", () => {
    expect(
      requiereDocsReevaluacion({ ...rechazada, reevaluaciones: [{ estado: ESTADOS_REEVALUACION.PENDIENTE }] }),
    ).toBe(false);
  });
});

describe("puedeClienteSubirDocumentos", () => {
  it("permite en ventana Legal (SGC)", () => {
    expect(puedeClienteSubirDocumentos(base)).toBe(true);
  });

  it("permite preparar una re-evaluacion", () => {
    expect(puedeClienteSubirDocumentos({ ...base, estadoSolicitud: ESTADOS_SOLICITUD.RECHAZADO, sgcEstadoEnvio: null })).toBe(true);
  });

  it("bloquea si no esta en ventana ni prepara re-evaluacion", () => {
    expect(
      puedeClienteSubirDocumentos({ ...base, estadoSolicitud: ESTADOS_SOLICITUD.APROBADO, sgcEstadoEnvio: null, sgcDocumentosEnviados: true }),
    ).toBe(false);
  });
});
