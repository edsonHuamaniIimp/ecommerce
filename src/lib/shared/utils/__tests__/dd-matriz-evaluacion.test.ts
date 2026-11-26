import { describe, expect, it } from "vitest";
import {
  normalizarResultadoReputacional,
  complianceDesbloqueado,
  derivarAmbito,
  evaluarBloqueArea,
  listasAplicables,
  normalizarConclusion,
  normalizarConclusionCompliance,
  normalizarResultado,
  normalizarResultadoFinal,
  normalizarSiNoNa,
  normalizarTextoMatriz,
  resolverPais,
  resultadoFinalEditable,
  resultadoFinalEfectivo,
  estadoExpedienteDeResultadoFinal,
  urlFuenteLista,
  criteriosHallazgoSinObservacion,
  esHallazgo,
  esRespuestaFavorable,
  observacionesSigExportables,
  sustentoSigCriterios,
  tieneHallazgo,
  tieneSustentoCriterios,
  valorHallazgo,
} from "../dd-matriz-evaluacion";
import {
  DD_ESTADOS,
  DD_MATRIZ_AMBITOS,
  DD_MATRIZ_AREAS,
  DD_MATRIZ_CONCLUSIONES,
  DD_MATRIZ_CONCLUSIONES_COMPLIANCE,
  DD_MATRIZ_GRUPOS_LISTA,
  DD_MATRIZ_LISTA_DESCRIPCIONES,
  DD_MATRIZ_LISTA_OTROS,
  DD_MATRIZ_LISTA_URLS,
  DD_MATRIZ_LISTAS,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_REPUTACION_RESULTADOS,
  DD_MATRIZ_SI_NO_NA,
  DD_MATRIZ_TIPOS_VINCULO,
  DD_MENSAJES,
} from "@/lib/shared/constants";

describe("normalizarTextoMatriz", () => {
  it("ignora tildes, mayusculas, puntuacion y espacios", () => {
    expect(normalizarTextoMatriz("  En   revisión. ")).toBe("EN REVISION");
    expect(normalizarTextoMatriz("N.A.")).toBe("N A");
    expect(normalizarTextoMatriz("n/a")).toBe("N A");
  });
});

describe("mapper de valores (negocio y desarrollo)", () => {
  it("acepta etiqueta de negocio, codigo de desarrollo y variantes", () => {
    expect(normalizarSiNoNa("SI")).toBe(DD_MATRIZ_SI_NO_NA.SI);
    expect(normalizarSiNoNa("si")).toBe(DD_MATRIZ_SI_NO_NA.SI);
    expect(normalizarSiNoNa("N.A")).toBe(DD_MATRIZ_SI_NO_NA.NA);
    expect(normalizarSiNoNa("N.A.")).toBe(DD_MATRIZ_SI_NO_NA.NA);
    expect(normalizarSiNoNa("na")).toBe(DD_MATRIZ_SI_NO_NA.NA);
    expect(normalizarSiNoNa("NO APLICA")).toBe(DD_MATRIZ_SI_NO_NA.NA);
    expect(normalizarSiNoNa("NO")).toBe(DD_MATRIZ_SI_NO_NA.NO);
  });

  it("devuelve null para vacio o desconocido", () => {
    expect(normalizarSiNoNa("")).toBeNull();
    expect(normalizarSiNoNa(null)).toBeNull();
    expect(normalizarSiNoNa("quizas")).toBeNull();
  });

  it("mapea resultado: ACEPTADO/OBSERVADO y variantes historicas del Excel", () => {
    expect(normalizarResultado("ACEPTADO")).toBe(DD_MATRIZ_RESULTADOS.ACEPTADO);
    expect(normalizarResultado("aceptado")).toBe(DD_MATRIZ_RESULTADOS.ACEPTADO);
    expect(normalizarResultado("SIN OBSERVACIONES")).toBe(DD_MATRIZ_RESULTADOS.ACEPTADO);
    expect(normalizarResultado("REQUIERE DEBIDA DILIGENCIA")).toBe(DD_MATRIZ_RESULTADOS.OBSERVADO);
    expect(normalizarResultado("NO APLICA DD")).toBe(DD_MATRIZ_RESULTADOS.NO_APLICA);
  });

  it("mapea conclusion con y sin tilde y la forma corta", () => {
    expect(normalizarConclusion("EN REVISIÓN")).toBe(DD_MATRIZ_CONCLUSIONES.EN_REVISION);
    expect(normalizarConclusion("EN REVISION")).toBe(DD_MATRIZ_CONCLUSIONES.EN_REVISION);
    expect(normalizarConclusion("en_revision")).toBe(DD_MATRIZ_CONCLUSIONES.EN_REVISION);
    expect(normalizarConclusion("REQUIERE DEBIDA DILIGENCIA")).toBe(
      DD_MATRIZ_CONCLUSIONES.REQUIERE_DEBIDA_DILIGENCIA,
    );
    expect(normalizarConclusion("REQUIERE DEBIDA DILIGENCIA REFORZADA")).toBe(
      DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA,
    );
  });

  it("mapea conclusion de Compliance y resultado final", () => {
    expect(normalizarConclusionCompliance("ACEPTADO CON OBSERVACIONES")).toBe(
      DD_MATRIZ_CONCLUSIONES_COMPLIANCE.ACEPTADO_CON_OBSERVACIONES,
    );
    expect(normalizarConclusionCompliance("RECHAZADO")).toBe(DD_MATRIZ_CONCLUSIONES_COMPLIANCE.RECHAZADO);
    expect(normalizarResultadoFinal("APTO CON OBSERVACIONES")).toBe(DD_MATRIZ_RESULTADOS_FINALES.APTO_CON_OBSERVACIONES);
    expect(normalizarResultadoFinal("DOCUMENTACION OBSERVADA")).toBe(DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA);
    expect(normalizarResultadoFinal("DOCUMENTACIÓN OBSERVADA")).toBe(DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA);
    expect(normalizarResultadoFinal("PENDIENTE")).toBe(DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION);
    expect(normalizarResultadoFinal("SIN RESPUESTA")).toBe(DD_MATRIZ_RESULTADOS_FINALES.SIN_RESPUESTA);
    expect(normalizarResultadoFinal("SIN RESPUESTA DE LA EMPRESA")).toBe(DD_MATRIZ_RESULTADOS_FINALES.SIN_RESPUESTA);
  });
});

describe("resultado final efectivo legacy", () => {
  it("usa el resultado guardado cuando existe", () => {
    expect(
      resultadoFinalEfectivo(DD_MATRIZ_RESULTADOS_FINALES.APTO, DD_ESTADOS.RECHAZADA),
    ).toBe(DD_MATRIZ_RESULTADOS_FINALES.APTO);
  });

  it("deriva el resultado desde el estado del expediente sin modificar la matriz", () => {
    expect(resultadoFinalEfectivo(null, DD_ESTADOS.APROBADA)).toBe(
      DD_MATRIZ_RESULTADOS_FINALES.APTO,
    );
    expect(resultadoFinalEfectivo(null, DD_ESTADOS.OBSERVADA)).toBe(
      DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA,
    );
    expect(resultadoFinalEfectivo(null, DD_ESTADOS.RECHAZADA)).toBe(
      DD_MATRIZ_RESULTADOS_FINALES.NO_APTO,
    );
    expect(resultadoFinalEfectivo(null, DD_ESTADOS.EN_REVISION)).toBe(
      DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION,
    );
    expect(resultadoFinalEfectivo(null, DD_ESTADOS.BORRADOR)).toBeNull();
  });

  it("bloquea la edicion de resultados finales cerrados", () => {
    for (const final of [
      DD_MATRIZ_RESULTADOS_FINALES.APTO,
      DD_MATRIZ_RESULTADOS_FINALES.APTO_CON_OBSERVACIONES,
      DD_MATRIZ_RESULTADOS_FINALES.NO_APTO,
      DD_MATRIZ_RESULTADOS_FINALES.SIN_RESPUESTA,
    ]) {
      expect(resultadoFinalEditable(final, DD_ESTADOS.EN_REVISION)).toBe(false);
    }
    expect(
      resultadoFinalEditable(DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION, DD_ESTADOS.EN_REVISION),
    ).toBe(true);
    expect(
      resultadoFinalEditable(
        DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA,
        DD_ESTADOS.OBSERVADA,
      ),
    ).toBe(true);
    expect(resultadoFinalEditable(null, DD_ESTADOS.APROBADA)).toBe(false);
  });

  it("invierte el mapeo para filtros legacy", () => {
    expect(estadoExpedienteDeResultadoFinal(DD_MATRIZ_RESULTADOS_FINALES.APTO)).toBe(
      DD_ESTADOS.APROBADA,
    );
    expect(estadoExpedienteDeResultadoFinal(DD_MATRIZ_RESULTADOS_FINALES.NO_APTO)).toBe(
      DD_ESTADOS.RECHAZADA,
    );
    expect(estadoExpedienteDeResultadoFinal(DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION)).toBeNull();
  });
});

describe("derivarAmbito", () => {
  it("empresa: nacional si el pais es Peru, extranjera en otro caso", () => {
    expect(derivarAmbito({ pais: "Perú" })).toBe(DD_MATRIZ_AMBITOS.NACIONAL);
    expect(derivarAmbito({ pais: "Chile" })).toBe(DD_MATRIZ_AMBITOS.EXTRANJERO);
  });

  it("persona: nacionalidad peruana o DNI => nacional; CE/pasaporte => extranjero", () => {
    expect(derivarAmbito({ nacionalidad: "Peruana" })).toBe(DD_MATRIZ_AMBITOS.NACIONAL);
    expect(derivarAmbito({ nacionalidad: "Chilena" })).toBe(DD_MATRIZ_AMBITOS.EXTRANJERO);
    expect(derivarAmbito({ tipoDocumento: "DNI" })).toBe(DD_MATRIZ_AMBITOS.NACIONAL);
    expect(derivarAmbito({ tipoDocumento: "CE" })).toBe(DD_MATRIZ_AMBITOS.EXTRANJERO);
  });

  it("sin datos asume nacional", () => {
    expect(derivarAmbito({})).toBe(DD_MATRIZ_AMBITOS.NACIONAL);
  });

  it("usa el pais ISO conocido (Empresa.pais): PE nacional, otro extranjero", () => {
    expect(derivarAmbito({ paisIso: "PE" })).toBe(DD_MATRIZ_AMBITOS.NACIONAL);
    expect(derivarAmbito({ paisIso: "CL" })).toBe(DD_MATRIZ_AMBITOS.EXTRANJERO);
    expect(derivarAmbito({ paisIso: "CL", pais: "Perú" })).toBe(DD_MATRIZ_AMBITOS.EXTRANJERO);
  });

  it("acepta los dos formatos de tipo de documento: texto del expediente y codigos 1/4/7", () => {
    expect(derivarAmbito({ tipoDocumento: "Carnet de extranjería" })).toBe(DD_MATRIZ_AMBITOS.EXTRANJERO);
    expect(derivarAmbito({ tipoDocumento: "Pasaporte" })).toBe(DD_MATRIZ_AMBITOS.EXTRANJERO);
    expect(derivarAmbito({ tipoDocumento: "4" })).toBe(DD_MATRIZ_AMBITOS.EXTRANJERO);
    expect(derivarAmbito({ tipoDocumento: "7" })).toBe(DD_MATRIZ_AMBITOS.EXTRANJERO);
    expect(derivarAmbito({ tipoDocumento: "1" })).toBe(DD_MATRIZ_AMBITOS.NACIONAL);
  });

  it("nacionalidad no reconocida no decide: cae al tipo de documento o a nacional", () => {
    expect(derivarAmbito({ nacionalidad: "Atlantida", tipoDocumento: "CE" })).toBe(DD_MATRIZ_AMBITOS.EXTRANJERO);
    expect(derivarAmbito({ nacionalidad: "Atlantida" })).toBe(DD_MATRIZ_AMBITOS.NACIONAL);
  });

  it("resolverPais prioriza el ISO conocido y luego pais/nacionalidad", () => {
    expect(resolverPais({ paisIso: "CL", nacionalidad: "Peruana" })).toBe("CL");
    expect(resolverPais({ pais: "Perú" })).toBe("PE");
    expect(resolverPais({ nacionalidad: "Argentina" })).toBe("AR");
    expect(resolverPais({})).toBeNull();
  });
});

describe("listasAplicables", () => {
  const sinAdicionales = (listas: ReturnType<typeof listasAplicables>) =>
    listas.filter((x) => x.grupo !== DD_MATRIZ_GRUPOS_LISTA.ADICIONAL);

  it("empresa nacional: 7 listas de empresa nacional (incluye OSCE)", () => {
    const l = sinAdicionales(listasAplicables(DD_MATRIZ_TIPOS_VINCULO.EMPRESA, DD_MATRIZ_AMBITOS.NACIONAL));
    expect(l).toHaveLength(7);
    expect(l.every((x) => x.grupo === DD_MATRIZ_GRUPOS_LISTA.EMPRESA_NACIONAL)).toBe(true);
  });

  it("todo vinculo incluye el criterio adicional Otros, sea cual sea su tipo o ambito", () => {
    const combinaciones = [
      listasAplicables(DD_MATRIZ_TIPOS_VINCULO.EMPRESA, DD_MATRIZ_AMBITOS.NACIONAL),
      listasAplicables(DD_MATRIZ_TIPOS_VINCULO.EMPRESA, DD_MATRIZ_AMBITOS.EXTRANJERO),
      listasAplicables(DD_MATRIZ_TIPOS_VINCULO.REPRESENTANTE, DD_MATRIZ_AMBITOS.NACIONAL),
      listasAplicables(DD_MATRIZ_TIPOS_VINCULO.VINCULADO, DD_MATRIZ_AMBITOS.EXTRANJERO),
      listasAplicables(DD_MATRIZ_TIPOS_VINCULO.VINCULADO, DD_MATRIZ_AMBITOS.NACIONAL, "RUC"),
    ];
    for (const listas of combinaciones) {
      const otros = listas.filter((x) => x.codigo === DD_MATRIZ_LISTA_OTROS);
      expect(otros).toHaveLength(1);
      expect(otros[0]?.label).toBe("Otros");
    }
  });

  it("Otros no pertenece a la matriz oficial: queda fuera de los grupos exportables al Excel", () => {
    const otros = DD_MATRIZ_LISTAS.find((x) => x.codigo === DD_MATRIZ_LISTA_OTROS);
    expect(otros?.grupo).toBe(DD_MATRIZ_GRUPOS_LISTA.ADICIONAL);
  });

  it("persona nacional: listas de persona vinculada", () => {
    const l = listasAplicables(DD_MATRIZ_TIPOS_VINCULO.REPRESENTANTE, DD_MATRIZ_AMBITOS.NACIONAL);
    expect(l.map((x) => x.codigo)).toContain("conflicto_interes");
    expect(sinAdicionales(l).every((x) => x.grupo === DD_MATRIZ_GRUPOS_LISTA.PERSONA_VINCULADA)).toBe(true);
  });

  it("extranjero: listas extranjeras (11) y, si es persona, conflicto de interes", () => {
    const empresa = sinAdicionales(listasAplicables(DD_MATRIZ_TIPOS_VINCULO.EMPRESA, DD_MATRIZ_AMBITOS.EXTRANJERO));
    expect(empresa).toHaveLength(11);
    const persona = sinAdicionales(listasAplicables(DD_MATRIZ_TIPOS_VINCULO.VINCULADO, DD_MATRIZ_AMBITOS.EXTRANJERO));
    expect(persona).toHaveLength(12);
    expect(persona.map((x) => x.codigo)).toContain("conflicto_interes");
  });

  it("empresa vinculada con RUC usa listas de empresa", () => {
    const l = sinAdicionales(
      listasAplicables(DD_MATRIZ_TIPOS_VINCULO.VINCULADO, DD_MATRIZ_AMBITOS.NACIONAL, "RUC"),
    );
    expect(l).toHaveLength(7);
    expect(l.every((x) => x.grupo === DD_MATRIZ_GRUPOS_LISTA.EMPRESA_NACIONAL)).toBe(true);
    expect(l.map((x) => x.codigo)).not.toContain("conflicto_interes");
  });

  it("persona vinculada con DNI conserva listas de persona", () => {
    const l = sinAdicionales(
      listasAplicables(DD_MATRIZ_TIPOS_VINCULO.VINCULADO, DD_MATRIZ_AMBITOS.NACIONAL, "DNI"),
    );
    expect(l.every((x) => x.grupo === DD_MATRIZ_GRUPOS_LISTA.PERSONA_VINCULADA)).toBe(true);
    expect(l.map((x) => x.codigo)).toContain("conflicto_interes");
  });

  it("cada criterio tiene una descripcion breve y no hay descripciones huerfanas", () => {
    for (const lista of DD_MATRIZ_LISTAS) {
      const descripcion = DD_MATRIZ_LISTA_DESCRIPCIONES[lista.codigo];
      expect(descripcion, lista.codigo).toBeTruthy();
      expect(descripcion?.length ?? 0).toBeLessThanOrEqual(70);
    }
    for (const codigo of Object.keys(DD_MATRIZ_LISTA_DESCRIPCIONES)) {
      expect(DD_MATRIZ_LISTAS.some((lista) => lista.codigo === codigo), codigo).toBe(true);
    }
  });

  it("todas las fuentes configuradas son HTTPS y pertenecen a un criterio existente", () => {
    for (const [codigo, fuente] of Object.entries(DD_MATRIZ_LISTA_URLS)) {
      expect(fuente.url).toMatch(/^https:\/\//);
      expect(DD_MATRIZ_LISTAS.some((lista) => lista.codigo === codigo)).toBe(true);
    }
  });

  it("arma busqueda directa para OpenSanctions y DEA sin romper el nombre", () => {
    expect(urlFuenteLista("opensanctions", "YURA S.A.", null)).toBe(
      "https://www.opensanctions.org/search/?q=YURA%20S.A.",
    );
    expect(urlFuenteLista("dea", "JUAN PEREZ", null)).toBe(
      "https://www.dea.gov/fugitives/all?keywords=JUAN%20PEREZ",
    );
    expect(urlFuenteLista("indecopi", "YURA S.A.", null)).toBe(
      "https://enlinea.indecopi.gob.pe/miraaquienlecompras/#/busqueda-simple",
    );
    expect(urlFuenteLista("oefa", "YURA S.A.", null)).toBeNull();
  });
});

describe("hallazgo por criterio", () => {
  const POSITIVAS = ["central_riesgo_empresa", "central_riesgo_persona", "bancarizado_empresa", "bancarizado_persona"];

  it("solo central de riesgo y bancarizado tienen el hallazgo en NO; el resto en SI", () => {
    for (const lista of DD_MATRIZ_LISTAS) {
      expect(valorHallazgo(lista.codigo)).toBe(POSITIVAS.includes(lista.codigo) ? DD_MATRIZ_SI_NO_NA.NO : DD_MATRIZ_SI_NO_NA.SI);
    }
    expect(valorHallazgo("criterio_desconocido")).toBe(DD_MATRIZ_SI_NO_NA.SI);
  });

  it("esHallazgo / esRespuestaFavorable segun la pregunta; N.A. y vacio no son ninguno", () => {
    expect(esHallazgo("oefa", DD_MATRIZ_SI_NO_NA.SI)).toBe(true);
    expect(esHallazgo("oefa", DD_MATRIZ_SI_NO_NA.NO)).toBe(false);
    expect(esRespuestaFavorable("oefa", DD_MATRIZ_SI_NO_NA.NO)).toBe(true);
    expect(esHallazgo("central_riesgo_empresa", DD_MATRIZ_SI_NO_NA.SI)).toBe(false);
    expect(esRespuestaFavorable("central_riesgo_empresa", DD_MATRIZ_SI_NO_NA.SI)).toBe(true);
    expect(esHallazgo("central_riesgo_empresa", DD_MATRIZ_SI_NO_NA.NO)).toBe(true);
    expect(esHallazgo("bancarizado_persona", DD_MATRIZ_SI_NO_NA.NO)).toBe(true);
    for (const valor of [DD_MATRIZ_SI_NO_NA.NA, null, undefined, ""]) {
      expect(esHallazgo("oefa", valor)).toBe(false);
      expect(esHallazgo("central_riesgo_empresa", valor)).toBe(false);
      expect(esRespuestaFavorable("oefa", valor)).toBe(false);
    }
  });
});

describe("sustento en los criterios con hallazgo", () => {
  const listas = {
    oefa: DD_MATRIZ_SI_NO_NA.SI,
    indecopi: DD_MATRIZ_SI_NO_NA.SI,
    peps_prp_empresa: DD_MATRIZ_SI_NO_NA.NO,
    central_riesgo_empresa: DD_MATRIZ_SI_NO_NA.SI,
    bancarizado_empresa: DD_MATRIZ_SI_NO_NA.NO,
  };

  it("criteriosHallazgoSinObservacion: SI en criterios negativos y NO en los positivos, solo de los revisados", () => {
    const observaciones = { oefa: "Multa 10 UIT", indecopi: "   " };
    expect(
      criteriosHallazgoSinObservacion(
        ["oefa", "indecopi", "peps_prp_empresa", "central_riesgo_empresa", "bancarizado_empresa"],
        listas,
        observaciones,
      ),
    ).toEqual(["indecopi", "bancarizado_empresa"]);
    expect(criteriosHallazgoSinObservacion(["oefa", "central_riesgo_empresa"], listas, observaciones)).toEqual([]);
  });

  it("tieneSustentoCriterios: al menos un hallazgo con observacion", () => {
    expect(tieneSustentoCriterios(listas, { oefa: "Multa" })).toBe(true);
    expect(tieneSustentoCriterios(listas, { bancarizado_empresa: "Sin cuentas bancarias" })).toBe(true);
    expect(tieneSustentoCriterios(listas, { peps_prp_empresa: "Texto en un NO" })).toBe(false);
    expect(tieneSustentoCriterios(listas, { central_riesgo_empresa: "Calificacion normal" })).toBe(false);
    expect(tieneSustentoCriterios(listas, {})).toBe(false);
  });

  it("sustentoSigCriterios: con la regla exige hallazgo con observacion; sin la regla basta el hallazgo", () => {
    expect(sustentoSigCriterios(listas, {}, true)).toBe(false);
    expect(sustentoSigCriterios(listas, {}, false)).toBe(true);
    const sinHallazgo = { oefa: DD_MATRIZ_SI_NO_NA.NO, central_riesgo_empresa: DD_MATRIZ_SI_NO_NA.SI };
    expect(tieneHallazgo(sinHallazgo)).toBe(false);
    expect(sustentoSigCriterios(sinHallazgo, { oefa: "Texto" }, false)).toBe(false);
  });

  it("observacionesSigExportables: texto anterior y criterios con hallazgo en el orden de la matriz", () => {
    const texto = observacionesSigExportables("Anterior", listas, {
      indecopi: "Reclamo fundado",
      oefa: "Multa",
      peps_prp_empresa: "No va",
      central_riesgo_empresa: "Normal, no va",
      bancarizado_empresa: "Sin cuentas",
    });
    expect(texto).toBe(
      "Anterior\nQuejas o reporte desde INDECOPI: Reclamo fundado\nReportes infracciones OEFA: Multa\nBancarizado (empresa): Sin cuentas",
    );
    expect(observacionesSigExportables(null, listas, {})).toBeNull();
  });
});

describe("evaluarBloqueArea (reglas del proceso)", () => {
  it("ACEPTADO completa la conclusion por defecto como SIN OBSERVACIONES", () => {
    const r = evaluarBloqueArea(DD_MATRIZ_AREAS.SIG, { resultado: "ACEPTADO" });
    expect(r.errores).toEqual([]);
    expect(r.valor.resultado).toBe(DD_MATRIZ_RESULTADOS.ACEPTADO);
    expect(r.valor.conclusion).toBe(DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES);
  });

  it("OBSERVADO sin observacion es invalido", () => {
    const r = evaluarBloqueArea(DD_MATRIZ_AREAS.REPUTACIONAL, {
      resultado: "OBSERVADO",
      conclusion: "SIN OBSERVACIONES",
    });
    expect(r.errores.length).toBeGreaterThan(0);
  });

  it("OBSERVADO exige elegir SIN OBSERVACIONES o REQUIERE DD REFORZADA", () => {
    const sinConclusion = evaluarBloqueArea(DD_MATRIZ_AREAS.SIG, { resultado: "OBSERVADO", observaciones: "Hallazgo" });
    expect(sinConclusion.errores.length).toBeGreaterThan(0);

    const enRevision = evaluarBloqueArea(DD_MATRIZ_AREAS.SIG, {
      resultado: "OBSERVADO",
      observaciones: "Hallazgo",
      conclusion: "EN REVISION",
    });
    expect(enRevision.errores.length).toBeGreaterThan(0);

    const ok = evaluarBloqueArea(DD_MATRIZ_AREAS.SIG, {
      resultado: "OBSERVADO",
      observaciones: "Hallazgo",
      conclusion: "REQUIERE DEBIDA DILIGENCIA REFORZADA",
    });
    expect(ok.errores).toEqual([]);
    expect(ok.valor.conclusion).toBe(DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA);
  });

  it("SIG OBSERVADO se sustenta con criterios en SI con observacion (sin el texto del vinculo)", () => {
    const base = { resultado: "OBSERVADO", conclusion: "SIN OBSERVACIONES" };
    const sinSustento = evaluarBloqueArea(DD_MATRIZ_AREAS.SIG, base);
    expect(sinSustento.errores).toContain(DD_MENSAJES.MATRIZ_OBSERVADO_SIN_CRITERIO);
    expect(
      evaluarBloqueArea(DD_MATRIZ_AREAS.SIG, { ...base, observacionCriterioObligatoria: false }).errores,
    ).toContain(DD_MENSAJES.MATRIZ_OBSERVADO_SIN_HALLAZGO);
    expect(evaluarBloqueArea(DD_MATRIZ_AREAS.SIG, { ...base, sustentoCriterios: true }).errores).toEqual([]);
    /* El texto anterior del vinculo sigue valiendo como sustento. */
    expect(evaluarBloqueArea(DD_MATRIZ_AREAS.SIG, { ...base, observaciones: "Texto anterior" }).errores).toEqual([]);
    /* Compliance no cambia: sigue exigiendo su observacion. */
    expect(
      evaluarBloqueArea(DD_MATRIZ_AREAS.COMPLIANCE, { resultado: "OBSERVADO", conclusion: "OBSERVADO", sustentoCriterios: true }).errores,
    ).toContain("Una evaluación OBSERVADA exige registrar la observación");
  });

  it("EN REVISION sin resultado es valido (solo conocimiento interno)", () => {
    const r = evaluarBloqueArea(DD_MATRIZ_AREAS.SIG, { conclusion: "EN REVISION" });
    expect(r.errores).toEqual([]);
    expect(r.valor.conclusion).toBe(DD_MATRIZ_CONCLUSIONES.EN_REVISION);
  });

  it("valor desconocido se reporta como error", () => {
    const r = evaluarBloqueArea(DD_MATRIZ_AREAS.SIG, { resultado: "TAL VEZ" });
    expect(r.errores.length).toBeGreaterThan(0);
  });

  it("Compliance: usa su propio catalogo de conclusion", () => {
    const r = evaluarBloqueArea(DD_MATRIZ_AREAS.COMPLIANCE, {
      resultado: "ACEPTADO",
      conclusion: "ACEPTADO CON OBSERVACIONES",
    });
    expect(r.errores).toEqual([]);
    expect(r.valor.conclusion).toBe(DD_MATRIZ_CONCLUSIONES_COMPLIANCE.ACEPTADO_CON_OBSERVACIONES);

    const porDefecto = evaluarBloqueArea(DD_MATRIZ_AREAS.COMPLIANCE, { resultado: "ACEPTADO" });
    expect(porDefecto.valor.conclusion).toBe(DD_MATRIZ_CONCLUSIONES_COMPLIANCE.ACEPTADO);
  });

  it("Compliance OBSERVADO exige observacion", () => {
    const r = evaluarBloqueArea(DD_MATRIZ_AREAS.COMPLIANCE, {
      resultado: "OBSERVADO",
      conclusion: "RECHAZADO",
    });
    expect(r.errores.length).toBeGreaterThan(0);
  });

  it("Reputacional usa los cuatro términos del Excel en resultado y conclusión", () => {
    const sinObservaciones = evaluarBloqueArea(DD_MATRIZ_AREAS.REPUTACIONAL, {
      resultado: "SIN OBSERVACIONES",
    });
    expect(sinObservaciones.errores).toEqual([]);
    expect(sinObservaciones.valor.resultado).toBe(
      DD_REPUTACION_RESULTADOS.SIN_OBSERVACIONES,
    );
    expect(sinObservaciones.valor.conclusion).toBe(
      DD_REPUTACION_RESULTADOS.SIN_OBSERVACIONES,
    );

    const observado = evaluarBloqueArea(DD_MATRIZ_AREAS.REPUTACIONAL, {
      resultado: "OBSERVADO",
      observaciones: "Antecedente registrado",
    });
    expect(observado.errores).toEqual([]);
    expect(observado.valor.conclusion).toBe(DD_REPUTACION_RESULTADOS.OBSERVADO);

    const requiere = evaluarBloqueArea(DD_MATRIZ_AREAS.REPUTACIONAL, {
      resultado: "REQUIERE DEBIDA DILIGENCIA",
      observaciones: "Requiere revisión adicional",
    });
    expect(requiere.errores).toEqual([]);
    expect(requiere.valor.conclusion).toBe(
      DD_REPUTACION_RESULTADOS.REQUIERE_DEBIDA_DILIGENCIA,
    );
  });
});

describe("complianceDesbloqueado (regla 5)", () => {
  it("solo si SIG requiere DD reforzada y hay informe adjunto", () => {
    expect(complianceDesbloqueado(DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA, 1)).toBe(true);
    expect(complianceDesbloqueado(DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA, 0)).toBe(false);
    expect(complianceDesbloqueado(DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES, 3)).toBe(false);
    expect(complianceDesbloqueado(null, 3)).toBe(false);
  });
});

describe("conclusion reputacional de SIG", () => {
  it("acepta requiere_dd_reforzada (valor que envia la pantalla) como requiere debida diligencia", () => {
    expect(normalizarResultadoReputacional("requiere_dd_reforzada")).toBe("requiere_debida_diligencia");
    expect(normalizarResultadoReputacional("requiere_debida_diligencia")).toBe("requiere_debida_diligencia");
    expect(normalizarResultadoReputacional("sin_observaciones")).toBe("sin_observaciones");
  });
});

describe("pendientes de Comunicaciones para declarar APTO", () => {
  it("explica que falta en cada vinculo", async () => {
    const { pendientesComunicaciones } = await import("@/lib/shared/utils/dd-matriz-evaluacion");
    const pendientes = pendientesComunicaciones([
      { nombre: "Empresa", tipo: "empresa", resultado: null, conclusion: null },
      { nombre: "Socio", tipo: "beneficiario", resultado: "aceptado", conclusion: null },
      { nombre: "Director", tipo: "beneficiario", resultado: "observado", conclusion: "requiere_dd_reforzada" },
      { nombre: "Representante", tipo: "representante", resultado: "aceptado", conclusion: "sin_observaciones" },
    ]);
    expect(pendientes.map((p) => p.nombre)).toEqual(["Empresa", "Socio", "Director"]);
    expect(pendientes[0]?.motivo).toContain("aún no registró");
    expect(pendientes[1]?.accion).toContain("conclusión reputacional");
    expect(pendientes[2]?.motivo).toContain("hallazgos");
  });
});

describe("Documentacion recibida en el resultado final", () => {
  it("se ve como DOCUMENTACION RECIBIDA, no se edita y filtra por su estado", async () => {
    const m = await import("@/lib/shared/utils/dd-matriz-evaluacion");
    const { DD_ESTADOS: E, DD_MATRIZ_RESULTADOS_FINALES: F } = await import("@/lib/shared/constants");
    expect(m.resultadoFinalEfectivo(null, E.DOCUMENTACION_RECIBIDA)).toBe(F.DOCUMENTACION_RECIBIDA);
    expect(m.resultadoFinalEditable(null, E.DOCUMENTACION_RECIBIDA)).toBe(false);
    expect(m.resultadoFinalEditable(null, E.EN_REVISION)).toBe(true);
    expect(m.estadoExpedienteDeResultadoFinal(F.DOCUMENTACION_RECIBIDA)).toBe(E.DOCUMENTACION_RECIBIDA);
    /* El codigo no lleva tilde; la etiqueta si. Se reconoce escrito de cualquier forma. */
    for (const texto of ["DOCUMENTACIÓN RECIBIDA", "DOCUMENTACION RECIBIDA", "documentacion_recibida", " Documentación  recibida "]) {
      expect(m.normalizarResultadoFinal(texto)).toBe(F.DOCUMENTACION_RECIBIDA);
    }
    expect(E.DOCUMENTACION_RECIBIDA).toMatch(/^[a-z_]+$/);
    expect(F.DOCUMENTACION_RECIBIDA).toMatch(/^[a-z_]+$/);
  });
});
