import { describe, expect, it } from "vitest";
import {
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
} from "../dd-matriz-evaluacion";
import {
  DD_MATRIZ_AMBITOS,
  DD_MATRIZ_AREAS,
  DD_MATRIZ_CONCLUSIONES,
  DD_MATRIZ_CONCLUSIONES_COMPLIANCE,
  DD_MATRIZ_GRUPOS_LISTA,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MATRIZ_SI_NO_NA,
  DD_MATRIZ_TIPOS_VINCULO,
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
    expect(normalizarConclusion("REQUIERE DEBIDA DILIGENCIA")).toBe(DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA);
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
    expect(normalizarResultadoFinal("PENDIENTE")).toBe(DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION);
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
});

describe("listasAplicables", () => {
  it("empresa nacional: 6 listas de empresa nacional", () => {
    const l = listasAplicables(DD_MATRIZ_TIPOS_VINCULO.EMPRESA, DD_MATRIZ_AMBITOS.NACIONAL);
    expect(l).toHaveLength(6);
    expect(l.every((x) => x.grupo === DD_MATRIZ_GRUPOS_LISTA.EMPRESA_NACIONAL)).toBe(true);
  });

  it("persona nacional: listas de persona vinculada", () => {
    const l = listasAplicables(DD_MATRIZ_TIPOS_VINCULO.REPRESENTANTE, DD_MATRIZ_AMBITOS.NACIONAL);
    expect(l.map((x) => x.codigo)).toContain("conflicto_interes");
    expect(l.every((x) => x.grupo === DD_MATRIZ_GRUPOS_LISTA.PERSONA_VINCULADA)).toBe(true);
  });

  it("extranjero: listas extranjeras (11) y, si es persona, conflicto de interes", () => {
    const empresa = listasAplicables(DD_MATRIZ_TIPOS_VINCULO.EMPRESA, DD_MATRIZ_AMBITOS.EXTRANJERO);
    expect(empresa).toHaveLength(11);
    const persona = listasAplicables(DD_MATRIZ_TIPOS_VINCULO.VINCULADO, DD_MATRIZ_AMBITOS.EXTRANJERO);
    expect(persona).toHaveLength(12);
    expect(persona.map((x) => x.codigo)).toContain("conflicto_interes");
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
});

describe("complianceDesbloqueado (regla 5)", () => {
  it("solo si SIG requiere DD reforzada y hay informe adjunto", () => {
    expect(complianceDesbloqueado(DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA, 1)).toBe(true);
    expect(complianceDesbloqueado(DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA, 0)).toBe(false);
    expect(complianceDesbloqueado(DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES, 3)).toBe(false);
    expect(complianceDesbloqueado(null, 3)).toBe(false);
  });
});
