import { describe, expect, it } from "vitest";
import {
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MATRIZ_TIPOS_VINCULO,
} from "@/lib/shared/constants";
import { agruparInformes } from "@/lib/shared/utils/dd-informe";
import type { DdMatrizEvaluacionFilaDTO } from "@/types/dto/debida-diligencia";

function fila(cambios: Partial<DdMatrizEvaluacionFilaDTO>): DdMatrizEvaluacionFilaDTO {
  return {
    id: "fila-1",
    expedienteId: "exp-1",
    eventoId: "evento-1",
    eventoLabel: "PERUMIN 2027",
    codigo: "DD-2026-0001",
    expedienteEstado: "en_revision",
    empresaRazonSocial: "Empresa Uno S.A.C.",
    empresaRuc: "20100000001",
    motivo: null,
    eventoProyecto: "PERUMIN 38",
    fechaIngreso: "2026-01-01T00:00:00.000Z",
    tipo: DD_MATRIZ_TIPOS_VINCULO.EMPRESA,
    origen: "automatico",
    nombre: "Empresa Uno S.A.C.",
    tipoDocumento: "RUC",
    documento: "20100000001",
    cargo: null,
    ambito: "nacional",
    pais: "PE",
    sigResultado: null,
    sigConclusion: null,
    sigFecha: null,
    repResultado: null,
    repConclusion: null,
    repFecha: null,
    cmpResultado: null,
    cmpConclusion: null,
    cmpFecha: null,
    resultadoFinal: null,
    finalFecha: null,
    reputacionCasos: 0,
    reputacionPendientes: 0,
    reputacionEnAnalisis: 0,
    reputacionConHallazgos: 0,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...cambios,
  };
}

describe("agruparInformes", () => {
  it("agrupa por expediente y toma el resultado final de la fila empresa", () => {
    const grupos = agruparInformes([
      fila({
        id: "empresa",
        resultadoFinal: DD_MATRIZ_RESULTADOS_FINALES.APTO,
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
      fila({
        id: "representante",
        tipo: DD_MATRIZ_TIPOS_VINCULO.REPRESENTANTE,
        nombre: "Ana Pérez",
        repResultado: DD_MATRIZ_RESULTADOS.OBSERVADO,
        resultadoFinal: DD_MATRIZ_RESULTADOS_FINALES.APTO_CON_OBSERVACIONES,
        updatedAt: "2026-01-03T00:00:00.000Z",
      }),
      fila({
        id: "otra-empresa",
        expedienteId: "exp-2",
        codigo: "DD-2026-0002",
        empresaRazonSocial: "Empresa Dos S.A.C.",
      }),
    ]);

    expect(grupos).toHaveLength(2);
    const primero = grupos.find((grupo) => grupo.expedienteId === "exp-1");
    expect(primero?.totalVinculos).toBe(2);
    expect(primero?.conObservaciones).toBe(1);
    expect(primero?.resultadoFinal).toBe(DD_MATRIZ_RESULTADOS_FINALES.APTO);
    expect(primero?.actualizadoEn).toBe("2026-01-03T00:00:00.000Z");
  });

  it("cuenta pendientes cuando no hay resultado final", () => {
    const [grupo] = agruparInformes([fila({ id: "empresa" })]);
    expect(grupo).toBeDefined();
    if (!grupo) return;
    expect(grupo.pendientes).toBe(1);
    expect(grupo.resultadoFinal).toBeNull();
  });
});

