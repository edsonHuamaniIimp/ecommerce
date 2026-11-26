import { describe, expect, it } from "vitest";
import {
  DD_INFORME_CRITERIOS_DETALLAR,
  DD_INFORME_GRUPOS_OBSERVACION,
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
  detalleCriterio,
  detalleTieneObservacion,
  evidenciasConHallazgo,
  notasCriteriosSinSeccion,
  notasPorCriterios,
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

  it("cuenta pendientes cuando no hay resultado final y muestra el efectivo del estado", () => {
    const [grupo] = agruparInformes([fila({ id: "empresa" })]);
    expect(grupo).toBeDefined();
    if (!grupo) return;
    expect(grupo.pendientes).toBe(1);
    expect(grupo.resultadoFinal).toBe(DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION);
  });

  it("una DD en Documentacion recibida se ve como DOCUMENTACION RECIBIDA y no cuenta como conclusion", async () => {
    const { DD_ESTADOS } = await import("@/lib/shared/constants");
    const { esConclusionFinal } = await import("@/lib/shared/utils/dd-informe");
    const [grupo] = agruparInformes([fila({ id: "empresa", expedienteEstado: DD_ESTADOS.DOCUMENTACION_RECIBIDA })]);
    expect(grupo?.resultadoFinal).toBe(DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_RECIBIDA);
    expect(esConclusionFinal(grupo?.resultadoFinal)).toBe(false);
    expect(esConclusionFinal(DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION)).toBe(false);
    expect(esConclusionFinal(null)).toBe(false);
    expect(esConclusionFinal(DD_MATRIZ_RESULTADOS_FINALES.APTO)).toBe(true);
    expect(esConclusionFinal(DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA)).toBe(true);
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
      listas: [],
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

describe("anexos del PDF: solo criterios con SI", () => {
  const adj = (id: string, categoria: string) => ({
    id, categoria, nombre: id + ".pdf", url: "/u/" + id, mimeType: "application/pdf", tamano: 1, creadoPor: "x", createdAt: "2026-01-01T00:00:00.000Z",
  });
  it("incluye evidencias de criterios en SI y excluye NO, NA y sustentos generales", () => {
    const detalle = {
      listas: [
        { codigo: "oefa", label: "OEFA", color: "", valor: "si" },
        { codigo: "indecopi", label: "INDECOPI", color: "", valor: "no" },
        { codigo: "ofac", label: "OFAC", color: "", valor: "na" },
      ],
      adjuntos: [adj("a", "criterio_oefa"), adj("b", "criterio_indecopi"), adj("c", "criterio_ofac"), adj("d", "sig_sustento")],
    } as unknown as Parameters<typeof evidenciasConHallazgo>[0][number];
    expect(evidenciasConHallazgo([detalle]).map((x) => x.id)).toEqual(["a"]);
  });
});

describe("observaciones por criterio en el informe", () => {
  const detalle = (tipo: string, nombre: string, listas: [string, string, string | null][]) =>
    ({
      id: nombre,
      tipo,
      nombre,
      listas: listas.map(([codigo, valor, observacion]) => ({ codigo, label: codigo.toUpperCase(), color: "", valor, observacion })),
      adjuntos: [],
      sig: { resultado: null, observaciones: null, conclusion: null },
      reputacional: { resultado: null, observaciones: null, conclusion: null },
      compliance: { resultado: null, observaciones: null, conclusion: null },
    }) as unknown as DdMatrizEvaluacionDetalleDTO;

  it("toma las notas de criterios en SI y deja a la empresa titular primero", () => {
    const persona = detalle(DD_MATRIZ_TIPOS_VINCULO.BENEFICIARIO, "Ana Pérez", [
      ["peps_prp_persona", "si", "Fue regidora hasta 2022."],
    ]);
    const empresa = detalle(DD_MATRIZ_TIPOS_VINCULO.EMPRESA, "Empresa Uno S.A.C.", [
      ["peps_prp_empresa", "si", "Socio PEP declarado."],
    ]);
    const notas = notasPorCriterios([persona, empresa], DD_INFORME_GRUPOS_OBSERVACION.PEP);
    expect(notas.map((n) => n.texto)).toEqual(["Socio PEP declarado.", "Fue regidora hasta 2022."]);
    expect(notas[0]?.esTitular).toBe(true);
    expect(notas[1]?.vinculo).toBe("Ana Pérez");
  });

  it("ignora criterios en NO/NA, notas vacias y otros criterios", () => {
    const empresa = detalle(DD_MATRIZ_TIPOS_VINCULO.EMPRESA, "Empresa Uno S.A.C.", [
      ["oefa", "no", "no debe salir"],
      ["osce", "si", "   "],
      ["indecopi", "si", "otro grupo"],
    ]);
    const osce = detalle(DD_MATRIZ_TIPOS_VINCULO.EMPRESA, "Otra", [["osce", "si", "Multa firme del TCE."]]);
    expect(notasPorCriterios([empresa, osce], DD_INFORME_GRUPOS_OBSERVACION.OSCE).map((n) => n.texto)).toEqual(["Multa firme del TCE."]);
    expect(notasPorCriterios([empresa], DD_INFORME_GRUPOS_OBSERVACION.OEFA)).toEqual([]);
  });

  it("criterios sin seccion propia (listas internacionales, bancarizado) van a OTROS; los de grupo o Detallar no", () => {
    const empresa = detalle(DD_MATRIZ_TIPOS_VINCULO.EMPRESA, "Empresa Uno S.A.C.", [
      ["ofac", "si", "Coincidencia en OFAC."],
      ["indecopi", "si", "Reclamo fundado."],
      ["central_riesgo_empresa", "si", "Deuda vencida."],
      ["bancarizado_empresa", "no", "No sale (NO)."],
    ]);
    const persona = detalle(DD_MATRIZ_TIPOS_VINCULO.REPRESENTANTE, "Ana Pérez", [["bancarizado_persona", "si", "Sin cuentas."]]);
    const notas = notasCriteriosSinSeccion([persona, empresa]);
    expect(notas.map((n) => `${n.codigo}:${n.texto}`)).toEqual(["ofac:Coincidencia en OFAC.", "bancarizado_persona:Sin cuentas."]);
  });

  it("detalleCriterio: la observacion del criterio con cualquier valor; en personas antepone el nombre", () => {
    const empresa = detalle(DD_MATRIZ_TIPOS_VINCULO.EMPRESA, "Empresa Uno S.A.C.", [["central_riesgo_empresa", "no", "Sin deudas coactivas."]]);
    const persona = detalle(DD_MATRIZ_TIPOS_VINCULO.REPRESENTANTE, "Ana Pérez", [["conflicto_interes", "si", "Hermana de un gerente del IIMP."]]);
    expect(detalleCriterio([persona, empresa], DD_INFORME_CRITERIOS_DETALLAR.CENTRAL_RIESGO)).toBe("Sin deudas coactivas.");
    expect(detalleCriterio([persona, empresa], DD_INFORME_CRITERIOS_DETALLAR.CONFLICTO_INTERES)).toBe("Ana Pérez: Hermana de un gerente del IIMP.");
    expect(detalleCriterio([empresa], DD_INFORME_CRITERIOS_DETALLAR.CONFLICTO_INTERES)).toBeNull();
  });

  it("sin grupo (null) trae la observacion de todos los criterios en SI (seccion Observaciones y sustento)", () => {
    const empresa = detalle(DD_MATRIZ_TIPOS_VINCULO.EMPRESA, "Empresa Uno S.A.C.", [
      ["oefa", "no", "no debe salir"],
      ["indecopi", "si", "Reclamo fundado."],
      ["osce", "si", "Multa firme del TCE."],
    ]);
    expect(notasPorCriterios([empresa], null).map((n) => n.texto)).toEqual(["Reclamo fundado.", "Multa firme del TCE."]);
  });

  it("un vinculo con una observacion de criterio entra al informe", () => {
    const con = detalle(DD_MATRIZ_TIPOS_VINCULO.EMPRESA, "A", [["osce", "no", "algo"]]);
    const sin = detalle(DD_MATRIZ_TIPOS_VINCULO.EMPRESA, "B", [["osce", "no", null]]);
    expect(detalleTieneObservacion(con)).toBe(true);
    expect(detalleTieneObservacion(sin)).toBe(false);
  });
});
