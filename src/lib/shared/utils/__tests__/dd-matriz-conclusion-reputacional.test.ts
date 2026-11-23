import { describe, expect, it } from "vitest";
import { DD_MATRIZ_CONCLUSIONES, DD_REPUTACION_RESULTADOS } from "@/lib/shared/constants";
import { conclusionReputacionalTrasResultado } from "@/lib/shared/utils/dd-matriz-conclusion-reputacional";

const SIN = DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES;

describe("conclusionReputacionalTrasResultado", () => {
  it("aceptado sin conclusion previa deja 'sin observaciones' por defecto", () => {
    expect(
      conclusionReputacionalTrasResultado({ resultado: null, conclusion: null }, DD_REPUTACION_RESULTADOS.ACEPTADO),
    ).toBe(SIN);
  });

  it("sin_hallazgos y sin_observaciones tambien cuentan como aceptado", () => {
    for (const resultado of [DD_REPUTACION_RESULTADOS.SIN_HALLAZGOS, DD_REPUTACION_RESULTADOS.SIN_OBSERVACIONES]) {
      expect(conclusionReputacionalTrasResultado({ resultado: null, conclusion: null }, resultado)).toBe(SIN);
    }
  });

  it("respeta una conclusion que SIG ya definio", () => {
    expect(
      conclusionReputacionalTrasResultado(
        { resultado: null, conclusion: DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA },
        DD_REPUTACION_RESULTADOS.ACEPTADO,
      ),
    ).toBeUndefined();
  });

  it("observado sin conclusion previa no inventa una: decide SIG", () => {
    expect(
      conclusionReputacionalTrasResultado({ resultado: null, conclusion: null }, DD_REPUTACION_RESULTADOS.OBSERVADO),
    ).toBeUndefined();
  });

  it("pasar de aceptado a observado limpia la conclusion automatica", () => {
    expect(
      conclusionReputacionalTrasResultado(
        { resultado: DD_REPUTACION_RESULTADOS.ACEPTADO, conclusion: SIN },
        DD_REPUTACION_RESULTADOS.OBSERVADO,
      ),
    ).toBeNull();
  });

  it("pasar a observado conserva una conclusion distinta de la automatica", () => {
    expect(
      conclusionReputacionalTrasResultado(
        { resultado: DD_REPUTACION_RESULTADOS.ACEPTADO, conclusion: DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA },
        DD_REPUTACION_RESULTADOS.OBSERVADO,
      ),
    ).toBeUndefined();
  });
});
