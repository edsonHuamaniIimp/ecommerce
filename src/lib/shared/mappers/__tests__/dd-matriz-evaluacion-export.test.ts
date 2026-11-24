import { describe, expect, it } from "vitest";
import { DD_ESTADOS, DD_MATRIZ_RESULTADOS_FINALES } from "@/lib/shared/constants";
import type { DdMatrizExportItem } from "@/domain/models/dd-matriz-evaluacion";
import { mapDdMatrizExportFilaToDTO } from "@/lib/shared/mappers/dd-matriz-evaluacion";

const bloque = { fecha: null, responsable: null, resultado: null, observaciones: null, conclusion: null };

function item(resultadoFinal: string | null, estado: string): DdMatrizExportItem {
  const vinculo = {
    id: "v-1",
    tipo: "empresa",
    nombre: "Empresa Uno S.A.C.",
    ambito: "nacional",
    listas: {},
    sig: bloque,
    reputacional: bloque,
    compliance: bloque,
    resultadoFinal,
    expediente: {
      codigo: "DD-2026-0001",
      estado,
      eventoId: "e-1",
      eventoLabel: "PERUMIN 2027",
      fechaIngreso: new Date("2026-01-01T00:00:00Z"),
      fechaRevision: null,
      revisadoPor: null,
    },
  };
  return { vinculo, empresa: vinculo } as unknown as DdMatrizExportItem;
}

describe("mapDdMatrizExportFilaToDTO - resultado final", () => {
  it("sin resultado guardado usa el estado del expediente, igual que la bandeja", () => {
    expect(mapDdMatrizExportFilaToDTO(item(null, DD_ESTADOS.APROBADA)).vinculo.resultadoFinal).toBe(DD_MATRIZ_RESULTADOS_FINALES.APTO);
    expect(mapDdMatrizExportFilaToDTO(item(null, DD_ESTADOS.RECHAZADA)).vinculo.resultadoFinal).toBe(DD_MATRIZ_RESULTADOS_FINALES.NO_APTO);
    expect(mapDdMatrizExportFilaToDTO(item(null, DD_ESTADOS.EN_LEGAL)).vinculo.resultadoFinal).toBe(DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION);
    expect(mapDdMatrizExportFilaToDTO(item(null, DD_ESTADOS.OBSERVADA)).vinculo.resultadoFinal).toBe(DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA);
  });

  it("el resultado guardado manda sobre el estado del expediente", () => {
    const fila = mapDdMatrizExportFilaToDTO(item(DD_MATRIZ_RESULTADOS_FINALES.APTO_CON_OBSERVACIONES, DD_ESTADOS.APROBADA));
    expect(fila.vinculo.resultadoFinal).toBe(DD_MATRIZ_RESULTADOS_FINALES.APTO_CON_OBSERVACIONES);
  });

  it("un borrador sin resultado queda vacio", () => {
    expect(mapDdMatrizExportFilaToDTO(item(null, DD_ESTADOS.BORRADOR)).vinculo.resultadoFinal).toBeNull();
  });
});
