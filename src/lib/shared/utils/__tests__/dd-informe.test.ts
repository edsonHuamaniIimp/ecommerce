import { describe, expect, it } from "vitest";
import {
  DD_MATRIZ_CONCLUSIONES,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MATRIZ_TIPOS_VINCULO,
  DD_REPUTACION_ESTADOS,
  DD_REPUTACION_RESULTADOS,
} from "@/lib/shared/constants";
import {
  agruparInformes,
  casosReputacionConObservacion,
  detalleTieneObservacion,
  vinculosConObservaciones,
} from "@/lib/shared/utils/dd-informe";
import type {
  DdMatrizEvaluacionDetalleDTO,
  DdMatrizEvaluacionFilaDTO,
  DdReputacionCasoDTO,
} from "@/types/dto/debida-diligencia";

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


describe("informe PDF: solo vinculos con observaciones", () => {
  const bloque = (parcial: Partial<DdMatrizEvaluacionDetalleDTO["sig"]> = {}) =>
    ({ resultado: null, conclusion: null, observaciones: null, responsable: null, fecha: null, ...parcial }) as DdMatrizEvaluacionDetalleDTO["sig"];
  const detalle = (nombre: string, parcial: Partial<DdMatrizEvaluacionDetalleDTO> = {}): DdMatrizEvaluacionDetalleDTO =>
    ({
      id: nombre,
      tipo: "representante",
      nombre,
      sig: bloque(),
      reputacional: bloque(),
      compliance: bloque(),
      adjuntos: [],
      ...parcial,
    }) as unknown as DdMatrizEvaluacionDetalleDTO;
  const caso = (nombreARevisar: string, parcial: Partial<DdReputacionCasoDTO> = {}): DdReputacionCasoDTO =>
    ({ id: nombreARevisar, nombreARevisar, estado: DD_REPUTACION_ESTADOS.SIN_HALLAZGOS, resultado: null, comentario: null, ...parcial }) as unknown as DdReputacionCasoDTO;

  it("un vinculo limpio no tiene observaciones", () => {
    expect(detalleTieneObservacion(detalle("JUAN PEREZ"))).toBe(false);
  });

  it("detecta observacion por resultado OBSERVADO, conclusion reforzada o texto", () => {
    expect(detalleTieneObservacion(detalle("A", { sig: bloque({ resultado: DD_MATRIZ_RESULTADOS.OBSERVADO }) }))).toBe(true);
    expect(
      detalleTieneObservacion(detalle("B", { reputacional: bloque({ conclusion: DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA }) })),
    ).toBe(true);
    expect(detalleTieneObservacion(detalle("C", { compliance: bloque({ observaciones: "  Revisar poder  " }) }))).toBe(true);
    expect(detalleTieneObservacion(detalle("D", { compliance: bloque({ observaciones: "   " }) }))).toBe(false);
  });

  it("vinculosConObservaciones deja fuera a los vinculos limpios", () => {
    const detalles = [
      detalle("LIMPIO"),
      detalle("OBSERVADO", { sig: bloque({ resultado: DD_MATRIZ_RESULTADOS.OBSERVADO }) }),
    ];
    expect(vinculosConObservaciones(detalles).map((item) => item.nombre)).toEqual(["OBSERVADO"]);
  });

  it("los casos reputacionales del PDF excluyen a quienes no tienen observaciones", () => {
    const detalles = [
      detalle("Ana Pérez"),
      detalle("Luis Díaz", { sig: bloque({ observaciones: "Falta sustento" }) }),
    ];
    const casos = [
      caso("ANA PEREZ"),
      caso("LUIS DIAZ"),
      caso("EMPRESA X", { estado: DD_REPUTACION_ESTADOS.CON_HALLAZGOS }),
      caso("OTRO", { resultado: DD_REPUTACION_RESULTADOS.OBSERVADO }),
    ];
    expect(casosReputacionConObservacion(casos, detalles).map((item) => item.nombreARevisar)).toEqual([
      "LUIS DIAZ",
      "EMPRESA X",
      "OTRO",
    ]);
  });
});
