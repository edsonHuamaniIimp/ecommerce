import { describe, expect, it } from "vitest";
import {
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_TIPOS_DOCUMENTO_VINCULO,
  DD_TIPOS_VINCULO_PERSONA,
} from "@/lib/shared/constants";
import {
  calcularResultadoEmpresa,
  calcularVigenciaHasta,
  empresaBloqueadaPorRelaciones,
  esEmpresaVinculada,
  normalizarTipoDocumentoVinculo,
  porcentajeParticipacionValido,
  requierePorcentajeParticipacion,
  tipoDocumentoPredeterminadoVinculo,
  tipoDocumentoVinculoConConsulta,
} from "@/lib/shared/utils/debida-diligencia-v2";

describe("requierePorcentajeParticipacion", () => {
  it("exige porcentaje para beneficiario final y socio 10%", () => {
    expect(requierePorcentajeParticipacion(DD_TIPOS_VINCULO_PERSONA.BENEFICIARIO_FINAL)).toBe(true);
    expect(requierePorcentajeParticipacion(DD_TIPOS_VINCULO_PERSONA.SOCIO_10)).toBe(true);
  });

  it("no exige porcentaje para representante, apoderado, director ni gerente", () => {
    expect(requierePorcentajeParticipacion(DD_TIPOS_VINCULO_PERSONA.REPRESENTANTE_LEGAL)).toBe(false);
    expect(requierePorcentajeParticipacion(DD_TIPOS_VINCULO_PERSONA.APODERADO)).toBe(false);
    expect(requierePorcentajeParticipacion(DD_TIPOS_VINCULO_PERSONA.DIRECTOR)).toBe(false);
    expect(requierePorcentajeParticipacion(DD_TIPOS_VINCULO_PERSONA.GERENTE)).toBe(false);
  });

  it("devuelve false sin tipo de vínculo", () => {
    expect(requierePorcentajeParticipacion(null)).toBe(false);
    expect(requierePorcentajeParticipacion(undefined)).toBe(false);
  });
});

describe("porcentajeParticipacionValido", () => {
  it("acepta el mínimo de 10% para roles con porcentaje", () => {
    expect(porcentajeParticipacionValido(DD_TIPOS_VINCULO_PERSONA.SOCIO_10, 10)).toBe(true);
    expect(porcentajeParticipacionValido(DD_TIPOS_VINCULO_PERSONA.BENEFICIARIO_FINAL, 35.5)).toBe(true);
  });

  it("rechaza porcentaje menor al mínimo o ausente en roles con porcentaje", () => {
    expect(porcentajeParticipacionValido(DD_TIPOS_VINCULO_PERSONA.SOCIO_10, 9.99)).toBe(false);
    expect(porcentajeParticipacionValido(DD_TIPOS_VINCULO_PERSONA.SOCIO_10, null)).toBe(false);
    expect(porcentajeParticipacionValido(DD_TIPOS_VINCULO_PERSONA.BENEFICIARIO_FINAL, undefined)).toBe(false);
  });

  it("permite porcentaje opcional en roles sin exigencia", () => {
    expect(porcentajeParticipacionValido(DD_TIPOS_VINCULO_PERSONA.REPRESENTANTE_LEGAL, null)).toBe(true);
    expect(porcentajeParticipacionValido(DD_TIPOS_VINCULO_PERSONA.GERENTE, 5)).toBe(true);
  });

  it("rechaza porcentajes fuera de rango", () => {
    expect(porcentajeParticipacionValido(DD_TIPOS_VINCULO_PERSONA.GERENTE, 101)).toBe(false);
    expect(porcentajeParticipacionValido(DD_TIPOS_VINCULO_PERSONA.SOCIO_10, -1)).toBe(false);
  });
});

describe("tipo de documento del vínculo", () => {
  it("usa RUC fijo para empresa vinculada y DNI por defecto para personas", () => {
    expect(esEmpresaVinculada(DD_TIPOS_VINCULO_PERSONA.EMPRESA_VINCULADA)).toBe(true);
    expect(esEmpresaVinculada(DD_TIPOS_VINCULO_PERSONA.GERENTE)).toBe(false);
    expect(
      tipoDocumentoPredeterminadoVinculo(DD_TIPOS_VINCULO_PERSONA.EMPRESA_VINCULADA),
    ).toBe(DD_TIPOS_DOCUMENTO_VINCULO.RUC);
    expect(tipoDocumentoPredeterminadoVinculo(DD_TIPOS_VINCULO_PERSONA.GERENTE)).toBe(
      DD_TIPOS_DOCUMENTO_VINCULO.DNI,
    );
  });

  it("normaliza empresa a RUC y conserva el tipo declarado", () => {
    expect(
      normalizarTipoDocumentoVinculo(
        DD_TIPOS_VINCULO_PERSONA.EMPRESA_VINCULADA,
        DD_TIPOS_DOCUMENTO_VINCULO.DNI,
      ),
    ).toBe(DD_TIPOS_DOCUMENTO_VINCULO.RUC);
    expect(
      normalizarTipoDocumentoVinculo(
        DD_TIPOS_VINCULO_PERSONA.GERENTE,
        DD_TIPOS_DOCUMENTO_VINCULO.RUC,
      ),
    ).toBe(DD_TIPOS_DOCUMENTO_VINCULO.RUC);
    expect(
      normalizarTipoDocumentoVinculo(
        DD_TIPOS_VINCULO_PERSONA.DIRECTOR,
        DD_TIPOS_DOCUMENTO_VINCULO.PASAPORTE,
      ),
    ).toBe(DD_TIPOS_DOCUMENTO_VINCULO.PASAPORTE);
  });

  it("infiere pasaporte para extranjeros sin tipo declarado", () => {
    expect(
      normalizarTipoDocumentoVinculo(DD_TIPOS_VINCULO_PERSONA.DIRECTOR, null, "Chile"),
    ).toBe(DD_TIPOS_DOCUMENTO_VINCULO.PASAPORTE);
    expect(
      normalizarTipoDocumentoVinculo(DD_TIPOS_VINCULO_PERSONA.DIRECTOR, null, "Perú"),
    ).toBe(DD_TIPOS_DOCUMENTO_VINCULO.DNI);
  });

  it("solo habilita consulta para DNI o RUC", () => {
    expect(
      tipoDocumentoVinculoConConsulta(
        DD_TIPOS_VINCULO_PERSONA.EMPRESA_VINCULADA,
        DD_TIPOS_DOCUMENTO_VINCULO.RUC,
      ),
    ).toBe("RUC");
    expect(
      tipoDocumentoVinculoConConsulta(
        DD_TIPOS_VINCULO_PERSONA.BENEFICIARIO_FINAL,
        DD_TIPOS_DOCUMENTO_VINCULO.DNI,
      ),
    ).toBe("DNI");
    expect(
      tipoDocumentoVinculoConConsulta(
        DD_TIPOS_VINCULO_PERSONA.BENEFICIARIO_FINAL,
        DD_TIPOS_DOCUMENTO_VINCULO.CARNE_EXTRANJERIA,
      ),
    ).toBeNull();
    expect(
      tipoDocumentoVinculoConConsulta(
        DD_TIPOS_VINCULO_PERSONA.BENEFICIARIO_FINAL,
        DD_TIPOS_DOCUMENTO_VINCULO.PASAPORTE,
      ),
    ).toBeNull();
  });
});

describe("calcularVigenciaHasta", () => {
  it("suma 6 meses a la fecha de decisión sin mutar la original", () => {
    const decision = new Date("2026-01-15T00:00:00.000Z");
    const vigencia = calcularVigenciaHasta(decision);

    expect(vigencia.toISOString().slice(0, 10)).toBe("2026-07-15");
    expect(decision.toISOString().slice(0, 10)).toBe("2026-01-15");
  });

  it("respeta un número de meses distinto", () => {
    const decision = new Date("2026-03-01T00:00:00.000Z");
    expect(calcularVigenciaHasta(decision, 1).toISOString().slice(0, 10)).toBe("2026-04-01");
  });

  it("ajusta al último día del mes cuando el día no existe en el mes destino", () => {
    const decision = new Date("2026-01-31T00:00:00.000Z");
    expect(calcularVigenciaHasta(decision, 1).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});

describe("empresaBloqueadaPorRelaciones", () => {
  it("bloquea la empresa si alguna relación es NO APTO", () => {
    expect(
      empresaBloqueadaPorRelaciones([
        DD_MATRIZ_RESULTADOS_FINALES.APTO,
        DD_MATRIZ_RESULTADOS_FINALES.NO_APTO,
      ])
    ).toBe(true);
  });

  it("no bloquea si todas las relaciones son aptas o están en proceso", () => {
    expect(
      empresaBloqueadaPorRelaciones([
        DD_MATRIZ_RESULTADOS_FINALES.APTO,
        DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION,
        null,
      ])
    ).toBe(false);
  });
});

describe("calcularResultadoEmpresa", () => {
  it("prioriza NO APTO sobre cualquier otro resultado", () => {
    expect(
      calcularResultadoEmpresa([
        DD_MATRIZ_RESULTADOS_FINALES.APTO,
        DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION,
        DD_MATRIZ_RESULTADOS_FINALES.NO_APTO,
      ])
    ).toBe(DD_MATRIZ_RESULTADOS_FINALES.NO_APTO);
  });

  it("prioriza EN REVISIÓN sobre documentación observada y aptos", () => {
    expect(
      calcularResultadoEmpresa([
        DD_MATRIZ_RESULTADOS_FINALES.APTO_CON_OBSERVACIONES,
        DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION,
        DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA,
      ])
    ).toBe(DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION);
  });

  it("devuelve APTO cuando todas las relaciones son aptas", () => {
    expect(
      calcularResultadoEmpresa([
        DD_MATRIZ_RESULTADOS_FINALES.APTO,
        DD_MATRIZ_RESULTADOS_FINALES.APTO,
      ])
    ).toBe(DD_MATRIZ_RESULTADOS_FINALES.APTO);
  });

  it("devuelve null sin resultados", () => {
    expect(calcularResultadoEmpresa([null, undefined])).toBeNull();
  });
});

describe("empresa vinculada: RUC (Peru) o RUT (extranjera)", () => {
  const EV = DD_TIPOS_VINCULO_PERSONA.EMPRESA_VINCULADA;
  it("peruana o sin nacionalidad usa RUC", () => {
    expect(normalizarTipoDocumentoVinculo(EV, null, "Perú")).toBe(DD_TIPOS_DOCUMENTO_VINCULO.RUC);
    expect(normalizarTipoDocumentoVinculo(EV, null, null)).toBe(DD_TIPOS_DOCUMENTO_VINCULO.RUC);
  });
  it("extranjera usa RUT aunque llegue RUC", () => {
    expect(normalizarTipoDocumentoVinculo(EV, "RUC", "Alemania")).toBe(DD_TIPOS_DOCUMENTO_VINCULO.RUT);
    expect(tipoDocumentoPredeterminadoVinculo(EV, "Chile")).toBe(DD_TIPOS_DOCUMENTO_VINCULO.RUT);
  });
});
