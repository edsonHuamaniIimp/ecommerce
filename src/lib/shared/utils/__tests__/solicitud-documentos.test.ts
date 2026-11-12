import { describe, expect, it } from "vitest";
import { ESTADOS_DOCUMENTO_SOLICITUD, ESTADOS_REEVALUACION, ESTADOS_SOLICITUD, REVISION_AREAS, SGC_ESTADO_ENVIO, SGC_LIFECYCLE_STATUSES, SGC_SUBSANACION_MODOS, SGC_SUBSANACION_SUGERENCIAS, TIPOS_DOCUMENTO_SOLICITUD } from "@/lib/shared/constants";
import {
  anexosBloqueantesFaltantes,
  anexosRequeridosFaltantes,
  enVentanaContratoReserva,
  enVentanaDocumentosSgc,
  enVentanaLegalSgc,
  enVentanaSubsanacionSgc,
  esperandoContratoCorregidoSgc,
  faltanAnexosBloqueantes,
  hayContratoAdminNuevoParaFirmar,
  hayFirmadoPosteriorAlContratoCorregido,
  contratoClientePendienteFirma,
  contratoFirmadoPendienteReemplazo,
  puedeClienteSubirAnexosSgc,
  puedeClienteSubirDocumentos,
  requiereDocsReevaluacion,
  estadoCorreccionSgc,
  observacionesSgcSubsanadas,
  sgcObservacionesAbiertas,
  tieneObservacionSgcAnexos,
  tieneObservacionSgcContrato,
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
  docsAdjuntos: [] as Array<{ id?: string | null; nombre?: string | null; categoria?: string | null; userId?: string | null; requisito?: string | null; estado?: string | null; createdAt?: string | Date | null }>,
  revisiones: [{ area: REVISION_AREAS.ASOCIADO }],
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

describe("enVentanaContratoReserva", () => {
  const conContratoAdmin = { ...base, docsAdminCount: 1 };

  it("permite subir cuando el admin ya subio el contrato y la solicitud esta pendiente", () => {
    expect(enVentanaContratoReserva(conContratoAdmin)).toBe(true);
  });

  it("bloquea si aun no hay documento del admin", () => {
    expect(enVentanaContratoReserva(base)).toBe(false);
  });

  it("aplica tambien a reserva de un solo stand (envio inicial del wizard)", () => {
    expect(enVentanaContratoReserva({ ...conContratoAdmin, standCodes: ["A-1"] })).toBe(true);
  });

  it("no aplica si la solicitud no esta pendiente", () => {
    expect(enVentanaContratoReserva({ ...conContratoAdmin, estadoSolicitud: ESTADOS_SOLICITUD.APROBADO })).toBe(false);
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

describe("contratoFirmadoPendienteReemplazo", () => {
  const observado = {
    categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
    userId: CLIENTE,
    estado: ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO,
    createdAt: "2026-10-01T10:00:00Z",
  };

  it("true si el contrato firmado observado aun no tiene reemplazo activo", () => {
    expect(contratoFirmadoPendienteReemplazo({ ...base, docsAdjuntos: [observado] })).toBe(true);
  });

  it("false si ya existe una firma activa posterior", () => {
    const nuevo = { ...observado, estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO, createdAt: "2026-10-02T10:00:00Z" };
    expect(contratoFirmadoPendienteReemplazo({ ...base, docsAdjuntos: [observado, nuevo] })).toBe(false);
  });

  it("false si el documento observado es un anexo", () => {
    const anexo = { ...observado, categoria: TIPOS_DOCUMENTO_SOLICITUD.ANEXO };
    expect(contratoFirmadoPendienteReemplazo({ ...base, docsAdjuntos: [anexo] })).toBe(false);
  });
});

describe("hayFirmadoPosteriorAlContratoCorregido", () => {
  const admin = { categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO, userId: null, createdAt: "2026-09-30T10:00:00Z" };
  const firmado = { categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO, userId: CLIENTE, createdAt: "2026-09-20T10:00:00Z" };

  it("true si el cliente volvio a firmar despues del contrato corregido", () => {
    const firmadoNuevo = { ...firmado, createdAt: "2026-10-01T10:00:00Z" };
    expect(hayFirmadoPosteriorAlContratoCorregido({ ...base, docsAdjuntos: [admin, firmadoNuevo, firmado] })).toBe(true);
  });

  it("false si el contrato del admin es anterior al unico firmado (original, sin correccion)", () => {
    const adminOriginal = { ...admin, createdAt: "2026-09-01T10:00:00Z" };
    expect(hayFirmadoPosteriorAlContratoCorregido({ ...base, docsAdjuntos: [adminOriginal, firmado] })).toBe(false);
  });

  it("false si solo existe el firmado viejo (anterior a la correccion)", () => {
    expect(hayFirmadoPosteriorAlContratoCorregido({ ...base, docsAdjuntos: [admin, firmado] })).toBe(false);
  });

  it("false si el admin aun no subio el contrato corregido", () => {
    expect(hayFirmadoPosteriorAlContratoCorregido({ ...base, docsAdjuntos: [firmado] })).toBe(false);
  });

  it("false si el cliente nunca firmo", () => {
    expect(hayFirmadoPosteriorAlContratoCorregido({ ...base, docsAdjuntos: [admin] })).toBe(false);
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

  it("habilita anexos aunque el contrato corregido aun no exista", () => {
    expect(enVentanaDocumentosSgc(nuevoContratoSinSubir)).toBe(true);
    expect(puedeClienteSubirAnexosSgc(nuevoContratoSinSubir)).toBe(true);
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

  it("permite subir versiones nuevas cuando la solicitud esta Observada", () => {
    expect(
      puedeClienteSubirDocumentos({ ...base, estadoSolicitud: ESTADOS_SOLICITUD.OBSERVADO, sgcEstadoEnvio: null }),
    ).toBe(true);
  });
});

describe("anexos requeridos (RF-13)", () => {
  const doc = (requisito: string | null, overrides: Partial<{ userId: string | null; categoria: string | null }> = {}) => ({
    requisito,
    userId: CLIENTE,
    categoria: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
    ...overrides,
  });

  it("lista los tres requisitos cuando no hay documentos", () => {
    expect(anexosRequeridosFaltantes([])).toEqual(["ficha-ruc", "vigencia-poder", "dni-representante"]);
  });

  it("descuenta los requisitos ya cubiertos por documentos del cliente", () => {
    expect(anexosRequeridosFaltantes([doc("vigencia-poder")])).toEqual(["ficha-ruc", "dni-representante"]);
  });

  it("ignora el contrato firmado y los documentos del admin", () => {
    const docs = [
      doc("vigencia-poder", { categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO }),
      doc("dni-representante", { userId: null }),
    ];
    expect(anexosRequeridosFaltantes(docs)).toEqual(["ficha-ruc", "vigencia-poder", "dni-representante"]);
  });

  it("solo vigencia-poder y dni-representante bloquean (ficha-ruc no)", () => {
    expect(anexosBloqueantesFaltantes([doc("ficha-ruc")])).toEqual(["vigencia-poder", "dni-representante"]);
    expect(faltanAnexosBloqueantes([doc("ficha-ruc")])).toBe(true);
  });

  it("ignora documentos observados o reemplazados (deben subirse de nuevo)", () => {
    const docs = [
      { ...doc("ficha-ruc"), estado: ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO },
      { ...doc("vigencia-poder"), estado: ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO },
      { ...doc("dni-representante"), estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO },
    ];
    expect(anexosRequeridosFaltantes(docs)).toEqual(["ficha-ruc", "vigencia-poder"]);
  });

  it("sin faltantes bloqueantes no bloquea el envio a Legal", () => {
    const docs = [doc("vigencia-poder"), doc("dni-representante")];
    expect(anexosBloqueantesFaltantes(docs)).toEqual([]);
    expect(faltanAnexosBloqueantes(docs)).toBe(false);
  });

  it("tolera docs sin requisito (otros anexos)", () => {
    expect(faltanAnexosBloqueantes([doc(null)])).toBe(true);
  });
});


describe("contratoClientePendienteFirma — contrato posterior", () => {
  const firmado = (createdAt: string) => ({
    userId: CLIENTE,
    categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
    requisito: null,
    estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
    createdAt,
  });

  const contratoAdmin = {
    userId: null,
    categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
    requisito: null,
    estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
    createdAt: "2026-10-18T10:00:00.000Z",
  };

  it("solo muestra la firma cuando el revisor la habilito", () => {
    expect(contratoClientePendienteFirma({
      ...base,
      contratoHabilitado: false,
    })).toBe(false);
    expect(contratoClientePendienteFirma({
      ...base,
      contratoHabilitado: true,
    })).toBe(true);
  });

  it("un contrato antiguo del admin no reemplaza el habilitador", () => {
    expect(contratoClientePendienteFirma({
      ...base,
      docsAdjuntos: [contratoAdmin],
      contratoHabilitado: false,
    })).toBe(false);
  });

  it("oculta la firma si el cliente ya firmo la version vigente", () => {
    expect(contratoClientePendienteFirma({
      ...base,
      contratoHabilitado: true,
      docsAdjuntos: [contratoAdmin, firmado("2026-10-19T10:00:00.000Z")],
    })).toBe(false);
  });

  it("no muestra la firma inicial en una observacion: se usa Subsanar", () => {
    expect(contratoClientePendienteFirma({
      ...base,
      estadoSolicitud: ESTADOS_SOLICITUD.OBSERVADO,
      contratoHabilitado: true,
      docsAdjuntos: [contratoAdmin, firmado("2026-10-17T10:00:00.000Z")],
    })).toBe(false);
    expect(contratoClientePendienteFirma({
      ...base,
      estadoSolicitud: ESTADOS_SOLICITUD.OBSERVADO,
      contratoHabilitado: true,
      docsAdjuntos: [contratoAdmin],
    })).toBe(false);
  });
});

describe("observaciones SGC por documento", () => {
  const obsAnexo = {
    observationId: "o1",
    documentId: "d1",
    documentoLocalId: "doc-dni",
    categoria: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
    requisito: "dni-representante",
    nombre: "dni.pdf",
    title: "DNI o Pasaporte del Representante Legal",
    message: "Corrige el adjunto del DNI",
    status: "open",
    createdAt: "2026-11-03T21:51:29.930Z",
    requiresDocumentChange: true,
  };

  it("detecta observaciones abiertas y su tipo", () => {
    const s = {
      ...devuelto,
      sgcObservaciones: [obsAnexo, { ...obsAnexo, observationId: "o2", status: "resolved" }],
    };
    expect(sgcObservacionesAbiertas(s)).toHaveLength(1);
    expect(tieneObservacionSgcAnexos(s)).toBe(true);
    expect(tieneObservacionSgcContrato(s)).toBe(false);
  });

  it("no marca subsanada sin un documento posterior a la observacion", () => {
    const s = {
      ...devuelto,
      sgcObservaciones: [obsAnexo],
      docsAdjuntos: [{
        id: "doc-dni",
        userId: CLIENTE,
        categoria: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
        requisito: "dni-representante",
        nombre: "dni.pdf",
        estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
        createdAt: "2026-11-03T21:42:00.000Z",
      }],
    };
    expect(observacionesSgcSubsanadas(s)).toBe(false);
  });

  it("marca subsanada con un reemplazo activo posterior", () => {
    const s = {
      ...devuelto,
      sgcObservaciones: [obsAnexo],
      docsAdjuntos: [{
        id: "doc-nuevo",
        userId: CLIENTE,
        categoria: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
        requisito: "dni-representante",
        nombre: "dni-corregido.pdf",
        estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
        createdAt: "2026-11-03T22:10:00.000Z",
      }],
    };
    expect(observacionesSgcSubsanadas(s)).toBe(true);
  });

  it("una observacion de contrato exige firma posterior", () => {
    const obsContrato = {
      ...obsAnexo,
      categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
      requisito: null,
      nombre: "contrato.pdf",
      title: "Contrato",
    };
    const sinFirma = {
      ...devuelto,
      sgcObservaciones: [obsContrato],
      docsAdjuntos: [{
        id: "c1",
        userId: CLIENTE,
        categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
        estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
        createdAt: "2026-11-03T22:10:00.000Z",
      }],
    };
    expect(observacionesSgcSubsanadas(sinFirma)).toBe(false);

    const conFirma = {
      ...devuelto,
      sgcObservaciones: [obsContrato],
      docsAdjuntos: [{
        id: "f1",
        userId: CLIENTE,
        categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
        estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
        createdAt: "2026-11-03T22:10:00.000Z",
      }],
    };
    expect(observacionesSgcSubsanadas(conFirma)).toBe(true);
  });

  it("ignora observaciones administrativas sin cambio documental", () => {
    const s = { ...devuelto, sgcObservaciones: [{ ...obsAnexo, requiresDocumentChange: false }] };
    expect(observacionesSgcSubsanadas(s)).toBe(true);
  });
});

describe("estadoCorreccionSgc (v7: una observacion = un archivo)", () => {
  const obs = (id: string, extra: Record<string, unknown> = {}) => ({
    observationId: id,
    documentId: `doc-${id}`,
    requisito: `req-${id}`,
    title: `Documento ${id}`,
    message: `Corrige ${id}`,
    status: "open",
    createdAt: "2026-11-03T21:51:29.930Z",
    requiresDocumentChange: true,
    ...extra,
  });
  const doc = (id: string, requisito: string, createdAt: string) => ({
    id,
    userId: CLIENTE,
    categoria: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
    requisito,
    nombre: `${id}.pdf`,
    estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
    createdAt,
  });

  it("exige un archivo por cada observacion abierta", () => {
    const s = {
      ...devuelto,
      sgcObservaciones: [obs("a"), obs("b")],
      docsAdjuntos: [doc("fa", "req-a", "2026-11-03T22:10:00.000Z")],
    };
    const r = estadoCorreccionSgc(s);
    expect(r.requeridos).toBe(2);
    expect(r.cubiertos).toBe(1);
    expect(r.faltantes).toHaveLength(1);
    expect(r.faltantes[0]?.tipo).toBe("version");
  });

  it("un faltante sin documentId exige un archivo nuevo, no reutiliza el mismo", () => {
    const faltante = (id: string) => obs(id, { documentId: null, requiresNewDocument: true, requisito: null });
    const s = {
      ...devuelto,
      sgcObservaciones: [faltante("a"), faltante("b")],
      docsAdjuntos: [doc("nuevo", "req-x", "2026-11-03T22:10:00.000Z")],
    };
    const r = estadoCorreccionSgc(s);
    expect(r.requeridos).toBe(2);
    expect(r.cubiertos).toBe(1);
    expect(r.faltantes[0]?.tipo).toBe("nuevo");
  });

  it("no cuenta observaciones administrativas ni resueltas", () => {
    const s = {
      ...devuelto,
      sgcObservaciones: [
        obs("admin", { requiresDocumentChange: false }),
        obs("resuelta", { status: "resolved" }),
      ],
      docsAdjuntos: [],
    };
    expect(estadoCorreccionSgc(s)).toEqual({ requeridos: 0, cubiertos: 0, faltantes: [] });
    expect(observacionesSgcSubsanadas(s)).toBe(true);
  });

  it("cubre un anexo arbitrario por observationId, no por ser posterior", () => {
    const observacion = obs("arbitraria", {
      documentId: null,
      requisito: null,
      title: "Vigencia de poder de Apoderado Clase A",
      requiresNewDocument: true,
    });
    const ajeno = {
      ...doc("ajeno", "req-x", "2026-11-03T22:10:00.000Z"),
      sgcObservationId: "otra-observacion",
      sgcTitle: "Otro documento",
    };
    const vinculado = {
      ...doc("vinculado", "req-x", "2026-11-03T22:20:00.000Z"),
      sgcObservationId: "arbitraria",
      sgcTitle: "Vigencia de poder de Apoderado Clase A",
    };

    const sinVinculo = { ...devuelto, sgcObservaciones: [observacion], docsAdjuntos: [ajeno] };
    expect(observacionesSgcSubsanadas(sinVinculo)).toBe(false);

    const conVinculo = { ...devuelto, sgcObservaciones: [observacion], docsAdjuntos: [ajeno, vinculado] };
    expect(observacionesSgcSubsanadas(conVinculo)).toBe(true);
  });
});