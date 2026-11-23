import { describe, expect, it } from "vitest";
import {
  DD_ACCIONES_LEGAL,
  DD_DOCUMENTO_ESTADOS,
  DD_DOCUMENTOS,
  DD_DOCUMENTOS_REQUERIDOS,
  DD_ESTADOS,
  DD_ESTADOS_EVALUACION,
  DD_REPUTACION_ESTADOS,
  DD_REPUTACION_TIPOS,
  DD_RESULTADOS,
  DD_VINCULOS,
} from "@/lib/shared/constants";
import { DD_VIGENCIAS, ddUtils } from "@/lib/shared/utils/debida-diligencia";

const EXPEDIENTE_COMPLETO = {
  aceptaDatos: true,
  aceptaVerificacion: true,
  declaraVerdad: true,
  tipoRelacionComercial: ["exhibidor"],
  actividadEconomica: "Servicios",
  actividadEconomicaOtro: null,
  paisConstitucion: "Perú",
  sitioWeb: "https://empresa.pe",
  emailRepresentante: "contacto@empresa.pe",
  representanteNombre: "María Torres",
  representanteTipoDocumento: "DNI",
  representanteDocumento: "09876543",
  representanteNacionalidad: "Perú",
  documentos: Object.values(DD_DOCUMENTOS).map((tipo) => ({
    tipo,
    estado: DD_DOCUMENTO_ESTADOS.CARGADO,
  })),
};

describe("ddSumarMeses", () => {
  it("suma la vigencia de 6 meses conservando el dia", () => {
    const resultado = ddUtils.sumarMeses(new Date(2026, 0, 31), 6);
    expect(resultado.getFullYear()).toBe(2026);
    expect(resultado.getMonth()).toBe(6);
    expect(resultado.getDate()).toBe(31);
  });

  it("ajusta al ultimo dia del mes cuando el dia no existe", () => {
    const resultado = ddUtils.sumarMeses(new Date(2026, 7, 31), 6);
    expect(resultado.getMonth()).toBe(1);
    expect(resultado.getDate()).toBe(28);
  });
});

describe("ddEstadoVigencia", () => {
  const ahora = new Date(2026, 4, 12);

  it("marca sin vigencia los expedientes no aprobados", () => {
    expect(ddUtils.estadoVigencia(DD_ESTADOS.EN_REVISION, null, ahora)).toBe(DD_VIGENCIAS.SIN_VIGENCIA);
  });

  it("marca vencida una aprobacion sin fecha de cese ni de aprobacion", () => {
    expect(ddUtils.estadoVigencia(DD_ESTADOS.APROBADA, null, ahora)).toBe(DD_VIGENCIAS.VENCIDA);
  });

  it("calcula la vigencia desde la fecha de aprobacion", () => {
    expect(
      ddUtils.estadoVigencia(DD_ESTADOS.APROBADA, null, ahora, new Date(2026, 0, 1)),
    ).toBe(DD_VIGENCIAS.VIGENTE);
    expect(
      ddUtils.estadoVigencia(DD_ESTADOS.APROBADA, null, ahora, new Date(2025, 0, 1)),
    ).toBe(DD_VIGENCIAS.VENCIDA);
  });

  it("marca por vencer dentro de los 30 dias", () => {
    const vence = new Date(2026, 5, 1);
    expect(ddUtils.estadoVigencia(DD_ESTADOS.APROBADA, vence, ahora)).toBe(DD_VIGENCIAS.POR_VENCER);
  });

  it("marca vencida cuando la fecha ya paso", () => {
    expect(ddUtils.estadoVigencia(DD_ESTADOS.APROBADA, new Date(2026, 3, 1), ahora)).toBe(DD_VIGENCIAS.VENCIDA);
  });
});

describe("roles de reputacion", () => {
  const expediente = {
    empresa: { razonSocial: "YURA S.A." },
    representanteNombre: "EDSON JORDAN HUAMANI ÑAHUIN",
    beneficiarios: [{ nombre: "ANA BENEFICIARIA" }],
  };

  it("identifica empresa, representante y beneficiario", () => {
    expect(ddUtils.rolesNombreARevisar(expediente, "YURA S.A.")).toEqual([
      DD_REPUTACION_TIPOS.EMPRESA,
    ]);
    expect(ddUtils.rolesNombreARevisar(expediente, "EDSON JORDAN HUAMANI ÑAHUIN")).toEqual([
      DD_REPUTACION_TIPOS.REPRESENTANTE,
    ]);
    expect(ddUtils.rolesNombreARevisar(expediente, "ANA BENEFICIARIA")).toEqual([
      DD_REPUTACION_TIPOS.BENEFICIARIO,
    ]);
  });

  it("marca nombre derivado cuando no coincide con un rol conocido", () => {
    expect(ddUtils.rolesNombreARevisar(expediente, "OTRO NOMBRE")).toEqual([
      DD_REPUTACION_TIPOS.NOMBRE,
    ]);
  });
});

describe("resultado y vigencia institucional", () => {
  const ahora = new Date(2026, 4, 12);

  it("marca APTO una evaluacion aprobada sin observaciones", () => {
    expect(ddUtils.resultadoEvaluacion(DD_ESTADOS.APROBADA)).toBe(DD_RESULTADOS.APTO);
    expect(ddUtils.estadoEvaluacion(DD_ESTADOS.APROBADA, new Date(2026, 8, 1), ahora)).toBe(
      DD_ESTADOS_EVALUACION.VIGENTE,
    );
  });

  it("marca APTO CON OBSERVACIONES si la aprobacion conserva observaciones abiertas", () => {
    expect(ddUtils.resultadoEvaluacion(DD_ESTADOS.APROBADA, 1)).toBe(
      DD_RESULTADOS.APTO_CON_OBSERVACIONES,
    );
    expect(ddUtils.alcanceResultado(DD_RESULTADOS.APTO_CON_OBSERVACIONES)).toBe(
      "vinculo_especifico",
    );
  });

  it("marca NO APTO y PENDIENTE segun el estado del workflow", () => {
    expect(ddUtils.resultadoEvaluacion(DD_ESTADOS.RECHAZADA)).toBe(DD_RESULTADOS.NO_APTO);
    expect(ddUtils.resultadoEvaluacion(DD_ESTADOS.OBSERVADA)).toBe(DD_RESULTADOS.PENDIENTE);
    expect(ddUtils.resultadoEvaluacion(DD_ESTADOS.EN_REVISION)).toBe(DD_RESULTADOS.PENDIENTE);
  });

  it("exige nueva evaluacion cuando la aprobacion vencio", () => {
    expect(ddUtils.estadoEvaluacion(DD_ESTADOS.APROBADA, new Date(2026, 3, 1), ahora)).toBe(
      DD_ESTADOS_EVALUACION.REQUIERE_NUEVA_EVALUACION,
    );
    expect(ddUtils.diasVigenciaRestantes(DD_ESTADOS.APROBADA, new Date(2026, 3, 1), ahora)).toBe(0);
  });

  it("solo permite contratar con resultado apto, vigente y declaracion firmada", () => {
    expect(
      ddUtils.aptoParaContratar(
        DD_RESULTADOS.APTO,
        DD_ESTADOS_EVALUACION.VIGENTE,
        true,
      ),
    ).toBe(true);
    expect(
      ddUtils.aptoParaContratar(
        DD_RESULTADOS.APTO,
        DD_ESTADOS_EVALUACION.REQUIERE_NUEVA_EVALUACION,
        true,
      ),
    ).toBe(false);
    expect(
      ddUtils.aptoParaContratar(DD_RESULTADOS.APTO, DD_ESTADOS_EVALUACION.VIGENTE, false),
    ).toBe(false);
  });
});

describe("documentos y errores de envio", () => {
  it("detecta los documentos obligatorios faltantes", () => {
    const faltantes = ddUtils.documentosFaltantes([
      { tipo: DD_DOCUMENTOS.FICHA_RUC },
      { tipo: DD_DOCUMENTOS.PODERES },
    ]);
    expect(faltantes).toEqual([
      DD_DOCUMENTOS.IDENTIDAD_REPRESENTANTE,
      DD_DOCUMENTOS.DECLARACION_JURADA,
    ]);
  });

  it("exige la declaracion jurada aunque el resto de documentos este cargado", () => {
    expect(
      ddUtils.validarDocumentos({
        documentos: Object.values(DD_DOCUMENTOS)
          .filter((tipo) => tipo !== DD_DOCUMENTOS.DECLARACION_JURADA)
          .map((tipo) => ({
            tipo,
            url: "/uploads/documento.pdf",
            estado: DD_DOCUMENTO_ESTADOS.CARGADO,
          })),
        declaraVerdad: true,
      }),
    ).toContain("declaración jurada");
  });

  it("no devuelve errores cuando el expediente esta completo", () => {
    expect(ddUtils.erroresDeEnvio(EXPEDIENTE_COMPLETO)).toEqual([]);
  });

  it("solo exige la declaracion de vigencia cuando la empresa tiene una DD importada vigente", () => {
    const documentos = DD_DOCUMENTOS_REQUERIDOS.map((requisito) => ({
      tipo: requisito.tipo,
      url: "/uploads/documento.pdf",
      estado: DD_DOCUMENTO_ESTADOS.CARGADO,
    }));

    expect(
      ddUtils.validarDocumentos({
        documentos,
        declaraVerdad: true,
      }),
    ).toBeNull();
    expect(
      ddUtils.validarDocumentos({
        documentos,
        declaraVerdad: true,
        requiereDeclaracionVigencia: true,
      }),
    ).toContain("vigencia de información");
  });

  it("exige el detalle cuando la actividad economica es Otro", () => {
    const errores = ddUtils.erroresDeEnvio({
      ...EXPEDIENTE_COMPLETO,
      actividadEconomica: "Otro",
      actividadEconomicaOtro: "",
    });
    expect(errores).toContain("Indique cuál es la actividad económica.");
  });

  it("bloquea el envio con documentos observados", () => {
    const errores = ddUtils.erroresDeEnvio({
      ...EXPEDIENTE_COMPLETO,
      documentos: EXPEDIENTE_COMPLETO.documentos.map((d) =>
        d.tipo === DD_DOCUMENTOS.PODERES
          ? { ...d, estado: DD_DOCUMENTO_ESTADOS.OBSERVADO }
          : d,
      ),
    });
    expect(errores).toContain("Reemplace los documentos observados antes de reenviar.");
  });
});

describe("ddUtils.validarDocumentos", () => {
  it("bloquea el envio si queda un documento observado", () => {
    const resultado = ddUtils.validarDocumentos({
      documentos: Object.values(DD_DOCUMENTOS).map((tipo) => ({
        tipo,
        url: "/uploads/documento.pdf",
        estado: tipo === DD_DOCUMENTOS.FICHA_RUC
          ? DD_DOCUMENTO_ESTADOS.OBSERVADO
          : DD_DOCUMENTO_ESTADOS.CARGADO,
      })),
      declaraVerdad: true,
    });
    expect(resultado).toContain("nueva versión");
  });
});

describe("ddUtils.agruparObservacionesPorComentario", () => {
  it("muestra una sola vez un comentario compartido y conserva sus documentos", () => {
    const grupos = ddUtils.agruparObservacionesPorComentario([
      {
        id: "o-1",
        area: "logistica",
        texto: "Los documentos adjuntos son falsos.",
        createdAt: "2026-11-19T10:00:00.000Z",
        documentoTipo: DD_DOCUMENTOS.FICHA_RUC,
      },
      {
        id: "o-2",
        area: "logistica",
        texto: "Los documentos adjuntos son falsos.",
        createdAt: "2026-11-19T10:00:00.000Z",
        documentoTipo: DD_DOCUMENTOS.PODERES,
      },
      {
        id: "o-3",
        area: "logistica",
        texto: "Los documentos adjuntos son falsos.",
        createdAt: "2026-11-19T10:00:00.000Z",
        documentoTipo: DD_DOCUMENTOS.IDENTIDAD_REPRESENTANTE,
      },
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.texto).toBe("Los documentos adjuntos son falsos.");
    expect(grupos[0]?.documentos).toEqual([
      DD_DOCUMENTOS.FICHA_RUC,
      DD_DOCUMENTOS.PODERES,
      DD_DOCUMENTOS.IDENTIDAD_REPRESENTANTE,
    ]);
  });

  it("separa comentarios distintos o de distinta área", () => {
    const grupos = ddUtils.agruparObservacionesPorComentario([
      {
        id: "o-1",
        area: "logistica",
        texto: "Corregir ficha.",
        createdAt: "2026-11-19T10:00:00.000Z",
        documentoTipo: DD_DOCUMENTOS.FICHA_RUC,
      },
      {
        id: "o-2",
        area: "legal",
        texto: "Corregir ficha.",
        createdAt: "2026-11-19T10:00:00.000Z",
        documentoTipo: DD_DOCUMENTOS.FICHA_RUC,
      },
    ]);

    expect(grupos).toHaveLength(2);
  });
});

describe("ddNombresARevisar", () => {
  it("incluye empresa, representante y beneficiarios sin duplicados", () => {
    const nombres = ddUtils.nombresARevisar({
      empresa: { razonSocial: "Minera Andina S.A.C." },
      representanteNombre: "María Torres",
      beneficiarios: [{ nombre: "María Torres" }, { nombre: "Inversiones Sur S.A.C." }],
    });
    expect(nombres).toEqual(["Minera Andina S.A.C.", "María Torres", "Inversiones Sur S.A.C."]);
  });
});

describe("validaciones por paso", () => {
  it("exige ambos consentimientos en el paso 1", () => {
    expect(ddUtils.validarConsentimientos({ aceptaDatos: false, aceptaVerificacion: true })).toContain(
      "tratamiento de datos personales",
    );
    expect(ddUtils.validarConsentimientos({ aceptaDatos: true, aceptaVerificacion: false })).toContain(
      "debida diligencia reforzada",
    );
    expect(ddUtils.validarConsentimientos({ aceptaDatos: true, aceptaVerificacion: true })).toBeNull();
  });

  it("acepta varios vinculos comerciales y exige al menos uno", () => {
    const empresa = {
      tipoRelacionComercial: ["exhibidor", "proveedor"],
      actividadEconomica: "Servicios",
      actividadEconomicaOtro: "",
      paisConstitucion: "Perú",
      sitioWeb: "https://empresa.pe",
      emailRepresentante: "contacto@empresa.pe",
    };
    expect(ddUtils.validarEmpresa(empresa)).toBeNull();
    expect(
      ddUtils.validarEmpresa({ ...empresa, tipoRelacionComercial: [] }),
    ).toContain("al menos un tipo");
    expect(
      ddUtils.validarEmpresa({
        ...empresa,
        tipoRelacionComercial: [DD_VINCULOS.OTRO],
        tipoRelacionComercialOtro: "",
      }),
    ).toContain("detalle del vínculo comercial Otro");
    expect(
      ddUtils.validarEmpresa({
        ...empresa,
        tipoRelacionComercial: [DD_VINCULOS.OTRO],
        tipoRelacionComercialOtro: "Convenio de cooperación",
      }),
    ).toBeNull();
  });

  it("acepta participación 0 o vacía y rechaza porcentajes fuera de rango", () => {
    const datos = {
      representanteNombre: "María Torres",
      representanteDocumento: "09876543",
      representanteNacionalidad: "Perú",
      beneficiarios: [
        {
          nombre: "María Torres",
          documento: "12345678",
          tipoDocumento: "DNI",
          nacionalidad: "Perú",
          porcentaje: "0",
          tipoVinculoPersona: "beneficiario_final",
        },
      ],
    };
    expect(ddUtils.validarRepresentante(datos)).toBeNull();
    expect(
      ddUtils.validarRepresentante({
        ...datos,
        beneficiarios: [{ ...datos.beneficiarios[0]!, porcentaje: "" }],
      }),
    ).toBeNull();
    expect(
      ddUtils.validarRepresentante({
        ...datos,
        beneficiarios: [{ ...datos.beneficiarios[0]!, porcentaje: "101" }],
      }),
    ).toContain("entre 0% y 100%");
    expect(
      ddUtils.validarRepresentante({
        ...datos,
        beneficiarios: [{ ...datos.beneficiarios[0]!, tipoVinculoPersona: "" }],
      }),
    ).toContain("Seleccione el tipo de vínculo");
  });

  it("exige RUC para empresa vinculada y lo rechaza en personas", () => {
    const base = {
      representanteNombre: "María Torres",
      representanteDocumento: "09876543",
      representanteNacionalidad: "Perú",
      beneficiarios: [
        {
          nombre: "Inversiones Sur S.A.C.",
          documento: "20123456789",
          tipoDocumento: "RUC",
          nacionalidad: "Perú",
          porcentaje: "0",
          tipoVinculoPersona: "empresa_vinculada",
        },
      ],
    };
    expect(ddUtils.validarRepresentante(base)).toBeNull();
    expect(
      ddUtils.validarRepresentante({
        ...base,
        beneficiarios: [{ ...base.beneficiarios[0]!, tipoDocumento: "DNI" }],
      }),
    ).toContain("debe identificarse con RUC");
    expect(
      ddUtils.validarRepresentante({
        ...base,
        beneficiarios: [{
          ...base.beneficiarios[0]!,
          nombre: "María Torres",
          documento: "12345678",
          tipoDocumento: "RUC",
          tipoVinculoPersona: "beneficiario_final",
        }],
      }),
    ).toContain("El RUC solo aplica");
  });

  it("valida la longitud del DNI y del RUC", () => {
    const base = {
      representanteNombre: "María Torres",
      representanteDocumento: "09876543",
      representanteNacionalidad: "Perú",
      beneficiarios: [
        {
          nombre: "María Torres",
          documento: "12345678",
          tipoDocumento: "DNI",
          nacionalidad: "Perú",
          porcentaje: "0",
          tipoVinculoPersona: "beneficiario_final",
        },
      ],
    };
    expect(
      ddUtils.validarRepresentante({
        ...base,
        beneficiarios: [{ ...base.beneficiarios[0]!, documento: "1234567" }],
      }),
    ).toContain("debe tener 8 dígitos");
    expect(
      ddUtils.validarRepresentante({
        ...base,
        beneficiarios: [{
          ...base.beneficiarios[0]!,
          tipoDocumento: "RUC",
          tipoVinculoPersona: "empresa_vinculada",
          documento: "2012345678",
        }],
      }),
    ).toContain("debe tener 11 dígitos");
    expect(
      ddUtils.validarRepresentante({
        ...base,
        beneficiarios: [{ ...base.beneficiarios[0]!, tipoDocumento: "" }],
      }),
    ).toContain("Complete los datos");
  });

  it("mapea el resultado reputacional al estado persistido", () => {
    expect(ddUtils.estadoReputacion("sin_hallazgos", false)).toBe(DD_REPUTACION_ESTADOS.SIN_HALLAZGOS);
    expect(ddUtils.estadoReputacion("con_hallazgos", false)).toBe(DD_REPUTACION_ESTADOS.CON_HALLAZGOS);
    expect(ddUtils.estadoReputacion("requiere_informacion", true)).toBe(DD_REPUTACION_ESTADOS.CERRADA);
  });
});

describe("ddPuedeEditar", () => {
  it("permite editar borradores y expedientes observados", () => {
    expect(ddUtils.puedeEditar(null)).toBe(true);
    expect(ddUtils.puedeEditar(DD_ESTADOS.BORRADOR)).toBe(true);
    expect(ddUtils.puedeEditar(DD_ESTADOS.OBSERVADA)).toBe(true);
  });

  it("bloquea la edicion en revision, aprobados y rechazados", () => {
    expect(ddUtils.puedeEditar(DD_ESTADOS.EN_REVISION)).toBe(false);
    expect(ddUtils.puedeEditar(DD_ESTADOS.APROBADA)).toBe(false);
    expect(ddUtils.puedeEditar(DD_ESTADOS.RECHAZADA)).toBe(false);
  });
});


describe("ddUtils.subsanoObservacionLegal", () => {
  it("es true cuando vuelve a revision legal tras una observacion de Legal", () => {
    expect(ddUtils.subsanoObservacionLegal(DD_ESTADOS.EN_LEGAL, DD_ACCIONES_LEGAL.OBSERVAR)).toBe(true);
  });

  it("es false si Legal aun no observo o el expediente no esta en revision legal", () => {
    expect(ddUtils.subsanoObservacionLegal(DD_ESTADOS.EN_LEGAL, null)).toBe(false);
    expect(ddUtils.subsanoObservacionLegal(DD_ESTADOS.EN_LEGAL, DD_ACCIONES_LEGAL.APROBAR)).toBe(false);
    expect(ddUtils.subsanoObservacionLegal(DD_ESTADOS.OBSERVADA, DD_ACCIONES_LEGAL.OBSERVAR)).toBe(false);
    expect(ddUtils.subsanoObservacionLegal(undefined, undefined)).toBe(false);
  });
});

describe("ddUtils.pasosNavegables", () => {
  const base = { totalPasos: 4, modoSubsanacion: false };

  it("permite volver al paso mas lejano visitado aunque su validacion falle", () => {
    expect(ddUtils.pasosNavegables({ ...base, actual: 2, completados: [1, 2], pasoMaximo: 4 })).toEqual([1, 2, 3, 4]);
  });

  it("no habilita pasos que aun no se visitaron", () => {
    expect(ddUtils.pasosNavegables({ ...base, actual: 2, completados: [1], pasoMaximo: 2 })).toEqual([1, 2]);
  });

  it("en subsanacion habilita todos los pasos", () => {
    expect(
      ddUtils.pasosNavegables({ ...base, modoSubsanacion: true, actual: 4, completados: [], pasoMaximo: 4 }),
    ).toEqual([1, 2, 3, 4]);
  });
});

describe("ddUtils.validarRepresentante - documento repetido", () => {
  const datos = (documentoVinculo: string) => ({
    representanteNombre: "JACK GEORGE ESPIRITU SOTO",
    representanteDocumento: "08423451",
    representanteNacionalidad: "Perú",
    beneficiarios: [{
      nombre: "Otra Persona",
      documento: documentoVinculo,
      tipoDocumento: "DNI",
      nacionalidad: "Perú",
      porcentaje: "0",
      tipoVinculoPersona: "director",
    }],
  });

  it("rechaza un vinculo con el mismo documento del representante", () => {
    expect(ddUtils.validarRepresentante(datos("08423451"))).toContain("representante legal principal");
  });

  it("acepta un documento distinto", () => {
    expect(ddUtils.validarRepresentante(datos("08423452"))).toBeNull();
  });
});
