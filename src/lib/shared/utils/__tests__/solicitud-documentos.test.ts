import { describe, expect, it } from "vitest";
import { ESTADOS_REEVALUACION, ESTADOS_SOLICITUD, REVISION_AREAS, SGC_ESTADO_ENVIO, SGC_LIFECYCLE_STATUSES, SGC_SUBSANACION_MODOS, SGC_SUBSANACION_SUGERENCIAS, TIPOS_DOCUMENTO_SOLICITUD } from "@/lib/shared/constants";
import {
  enVentanaContratoMultistand,
  enVentanaLegalSgc,
  enVentanaSubsanacionSgc,
  esperandoContratoCorregidoSgc,
  hayContratoAdminNuevoParaFirmar,
  puedeClienteSubirDocumentos,
  requiereDocsReevaluacion,
} from "../solicitud-documentos";

const CLIENTE = "user-cliente";

const base = {
  estadoSolicitud: ESTADOS_SOLICITUD.PENDIENTE,
  standCodes: ["A-1", "A-2"],
  userId: CLIENTE,
  docsAdminCount: 0,
  clienteDocsAdjuntosCount: 0,
  reevaluaciones: [] as Array<{ estado: string }>,
  sgcEnabled: true,
  sgcEstadoEnvio: SGC_ESTADO_ENVIO.CREADO as string | null,
  sgcLifecycleStatus: null as string | null,
  sgcDocumentosEnviados: false,
  sgcSubsanacionModo: null as string | null,
  docsAdjuntos: [] as Array<{ categoria?: string | null; userId?: string | null; createdAt?: string | Date | null }>,
  revisiones: [{ area: REVISION_AREAS.LOGISTICA }, { area: REVISION_AREAS.COMUNICACION }],
};

const devuelto = {
  ...base,
  sgcDocumentosEnviados: true,
  sgcLifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED as string | null,
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

describe("enVentanaContratoMultistand", () => {
  const conContratoAdmin = { ...base, docsAdminCount: 1 };

  it("permite subir cuando el admin ya subio el contrato en reserva multiple pendiente", () => {
    expect(enVentanaContratoMultistand(conContratoAdmin)).toBe(true);
  });

  it("bloquea si aun no hay documento del admin", () => {
    expect(enVentanaContratoMultistand(base)).toBe(false);
  });

  it("no aplica a reserva simple", () => {
    expect(enVentanaContratoMultistand({ ...conContratoAdmin, standCodes: ["A-1"] })).toBe(false);
  });

  it("no aplica si la solicitud no esta pendiente", () => {
    expect(enVentanaContratoMultistand({ ...conContratoAdmin, estadoSolicitud: ESTADOS_SOLICITUD.APROBADO })).toBe(false);
  });
});

describe("hayContratoAdminNuevoParaFirmar", () => {
  const firmado = {
    categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
    userId: CLIENTE,
    createdAt: "2026-09-20T10:00:00Z",
  };

  it("true si el cliente aun no firmo ningun contrato", () => {
    expect(hayContratoAdminNuevoParaFirmar({ ...base, docsAdjuntos: [] })).toBe(true);
  });

  it("true si el contrato del admin es posterior al ultimo firmado", () => {
    const admin = { categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO, userId: null, createdAt: "2026-09-30T10:00:00Z" };
    expect(hayContratoAdminNuevoParaFirmar({ ...base, docsAdjuntos: [firmado, admin] })).toBe(true);
  });

  it("false si el contrato del admin es anterior al ultimo firmado", () => {
    const admin = { categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO, userId: null, createdAt: "2026-09-01T10:00:00Z" };
    expect(hayContratoAdminNuevoParaFirmar({ ...base, docsAdjuntos: [firmado, admin] })).toBe(false);
  });

  it("false si no hay contrato del admin", () => {
    expect(hayContratoAdminNuevoParaFirmar({ ...base, docsAdjuntos: [firmado] })).toBe(false);
  });
});

describe("subsanacion SGC segun el modo declarado por el admin", () => {
  const firmadoCliente = {
    categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
    userId: CLIENTE,
    createdAt: "2026-09-20T10:00:00Z",
  };
  const contratoAdminViejo = {
    categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
    userId: null,
    createdAt: "2026-09-10T10:00:00Z",
  };
  const mismoContrato = { ...devuelto, sgcSubsanacionModo: SGC_SUBSANACION_MODOS.MISMO_CONTRATO, docsAdjuntos: [firmadoCliente, contratoAdminViejo] };
  const nuevoContratoSinSubir = { ...devuelto, sgcSubsanacionModo: SGC_SUBSANACION_MODOS.NUEVO_CONTRATO, docsAdjuntos: [firmadoCliente, contratoAdminViejo] };

  it("permite firmar de inmediato con el modo 'mismo contrato'", () => {
    expect(enVentanaSubsanacionSgc(mismoContrato)).toBe(true);
    expect(esperandoContratoCorregidoSgc(mismoContrato)).toBe(false);
  });

  it("bloquea al cliente si el admin declaró 'nuevo contrato' y aun no lo subio", () => {
    expect(enVentanaSubsanacionSgc(nuevoContratoSinSubir)).toBe(false);
    expect(esperandoContratoCorregidoSgc(nuevoContratoSinSubir)).toBe(true);
    expect(puedeClienteSubirDocumentos(nuevoContratoSinSubir)).toBe(false);
  });

  it("habilita al cliente cuando el admin ya subio el contrato corregido", () => {
    const conContratoNuevo = {
      ...nuevoContratoSinSubir,
      docsAdjuntos: [
        firmadoCliente,
        contratoAdminViejo,
        { categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO, userId: null, createdAt: "2026-09-30T10:00:00Z" },
      ],
    };
    expect(enVentanaSubsanacionSgc(conContratoNuevo)).toBe(true);
    expect(esperandoContratoCorregidoSgc(conContratoNuevo)).toBe(false);
    expect(puedeClienteSubirDocumentos(conContratoNuevo)).toBe(true);
  });

  it("mantiene el comportamiento anterior cuando no hay modo (legacy)", () => {
    expect(enVentanaSubsanacionSgc(devuelto)).toBe(true);
    expect(esperandoContratoCorregidoSgc(devuelto)).toBe(false);
  });

  it("infiere 'nuevo contrato' en declaraciones previas (motivo sugerido sin modo)", () => {
    const sugerencia = SGC_SUBSANACION_SUGERENCIAS.find((x) => x.modo === SGC_SUBSANACION_MODOS.NUEVO_CONTRATO);
    const legacy = {
      ...devuelto,
      sgcSubsanacionModo: null,
      sgcSubsanacionMotivo: sugerencia?.texto ?? null,
      docsAdjuntos: [firmadoCliente, contratoAdminViejo],
    };
    expect(esperandoContratoCorregidoSgc(legacy)).toBe(true);
    expect(enVentanaSubsanacionSgc(legacy)).toBe(false);
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

  it("permite subir el contrato de reserva multiple sin expediente SGC", () => {
    expect(
      puedeClienteSubirDocumentos({ ...base, sgcEnabled: false, sgcEstadoEnvio: null, docsAdminCount: 1 }),
    ).toBe(true);
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
