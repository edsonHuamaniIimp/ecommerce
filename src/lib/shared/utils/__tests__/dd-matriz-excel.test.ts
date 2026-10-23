import { describe, expect, it } from "vitest";
import { COLUMNAS_MATRIZ_EXCEL, GRUPOS_MATRIZ_EXCEL, filaMatrizExcel } from "../dd-matriz-excel";
import type { DdMatrizBloqueDTO, DdMatrizEvaluacionExportFilaDTO } from "@/types/dto/debida-diligencia";
import { DD_MATRIZ_COLORES } from "@/lib/shared/constants";

const BLOQUE: DdMatrizBloqueDTO = { fecha: null, responsable: null, resultado: null, observaciones: null, conclusion: null };

/** Posicion (base 0) de una columna por su encabezado oficial. */
const col = (encabezado: string): number => {
  const i = COLUMNAS_MATRIZ_EXCEL.findIndex((c) => c.encabezado === encabezado);
  expect(i, encabezado).toBeGreaterThanOrEqual(0);
  return i;
};

function fila(parcial: {
  empresa?: Partial<DdMatrizEvaluacionExportFilaDTO["empresa"]>;
  vinculo?: Partial<DdMatrizEvaluacionExportFilaDTO["vinculo"]>;
}): DdMatrizEvaluacionExportFilaDTO {
  return {
    expedienteCodigo: "DD-2026-0107",
    fechaIngreso: "2026-10-04T00:00:00.000Z",
    fechaRevisionExpediente: "2026-10-19T00:00:00.000Z",
    revisadoPor: "importacion_masiva",
    empresa: {
      razonSocial: "MAPTEK S.A.C.",
      ruc: "20500193906",
      ambito: "nacional",
      pais: "PE",
      fechaInicioActividades: "1998-09-02",
      estadoContribuyente: "ACTIVO - HABIDO",
      direccionLegal: "AV. CANAVAL 609",
      actividadEconomica: "6202 - CONSULTORÍA",
      motivo: "Exhibidor",
      eventoProyecto: "WMC",
      historialIimp: "si",
      beneficioMutuo: "no",
      listas: { indecopi: "no", oefa: "si" },
      ...parcial.empresa,
    },
    vinculo: {
      tipo: "empresa",
      nombre: "MAPTEK S.A.C.",
      tipoDocumento: "RUC",
      documento: "20500193906",
      nacionalidad: null,
      cargo: null,
      ambito: "nacional",
      pais: "PE",
      listas: { indecopi: "no", oefa: "si" },
      sig: { ...BLOQUE },
      reputacional: { ...BLOQUE },
      compliance: { ...BLOQUE },
      resultadoFinal: null,
      ...parcial.vinculo,
    },
  };
}

describe("matriz oficial: estructura", () => {
  it("tiene las 54 columnas A-BB y los grupos cubren todas sin huecos", () => {
    expect(COLUMNAS_MATRIZ_EXCEL).toHaveLength(54);
    expect(GRUPOS_MATRIZ_EXCEL[0]?.desde).toBe(0);
    expect(GRUPOS_MATRIZ_EXCEL.at(-1)?.hasta).toBe(53);
    GRUPOS_MATRIZ_EXCEL.slice(1).forEach((g, i) => expect(g.desde).toBe((GRUPOS_MATRIZ_EXCEL[i]?.hasta ?? 0) + 1));
  });

  it("colores de encabezado: naranja Q-V/AA-AC/AE, celeste AF-AP y lila el resto", () => {
    expect(COLUMNAS_MATRIZ_EXCEL.slice(16, 22).every((c) => c.color === DD_MATRIZ_COLORES.NACIONAL)).toBe(true);
    expect(COLUMNAS_MATRIZ_EXCEL.slice(31, 42).every((c) => c.color === DD_MATRIZ_COLORES.EXTRANJERO)).toBe(true);
    expect(COLUMNAS_MATRIZ_EXCEL[col("HAY CONFLICTOS DE INTERÉS")]?.color).toBe(DD_MATRIZ_COLORES.COMUN);
    expect(COLUMNAS_MATRIZ_EXCEL[col("HAY REPORTES DE CORRUPCIÓN / SOBORNO / LAVADO")]?.color).toBe(DD_MATRIZ_COLORES.NACIONAL);
    expect(COLUMNAS_MATRIZ_EXCEL[0]?.color).toBe(DD_MATRIZ_COLORES.COMUN);
    expect(COLUMNAS_MATRIZ_EXCEL[53]?.color).toBe(DD_MATRIZ_COLORES.COMUN);
  });
});

describe("filaMatrizExcel", () => {
  it("empresa nacional: datos generales, listas nacionales y N.A. en lo extranjero y de personas", () => {
    const v = filaMatrizExcel(fila({}));
    expect(v[col("N°")]).toBe(107);
    expect(v[col("RAZON SOCIAL EMPRESA / PERSONA")]).toBe("MAPTEK S.A.C.");
    expect(v[col("EMPRESA NACIONAL O EXTRANJERA")]).toBe("NACIONAL");
    expect(v[col("NACIONALIDAD")]).toBe("PERÚ");
    expect(v[col("HISTORIAL CON IIMP")]).toBe("SI");
    expect(v[col("QUEJAS O REPORTE DESDE INDECOPI")]).toBe("NO");
    expect(v[col("REPORTES INFRACCIONES OEFA")]).toBe("SI");
    expect(v[col("REPORTES LISTAS PEPS / PRP")]).toBe(""); // aplica pero aun no se evalua
    expect(v[col("REGISTRA ANTECEDENTES EN OFAC")]).toBe("N.A.");
    expect(v[col("LISTAS PEPS / PRP")]).toBe("N.A.");
    expect(v[col("REPRESENTANTE LEGAL / OTRAS PERSONAS o EMPRESAS VINCULAS")]).toBe("");
  });

  it("persona nacional: sus datos y sus listas; la empresa repite Q-V", () => {
    const v = filaMatrizExcel(
      fila({
        vinculo: {
          tipo: "representante",
          nombre: "CASTILLO GONZALES LUIS",
          tipoDocumento: "DNI",
          documento: "41922107",
          nacionalidad: "Peruana",
          cargo: "Apoderado",
          listas: { peps_prp_persona: "no", conflicto_interes: "no" },
        },
      }),
    );
    expect(v[col("REPRESENTANTE LEGAL / OTRAS PERSONAS o EMPRESAS VINCULAS")]).toBe("CASTILLO GONZALES LUIS");
    expect(v[col("DOCUMENTO DE IDENTIDAD")]).toBe("41922107 - DNI");
    expect(v[col("CARGO")]).toBe("Apoderado");
    expect(v[col("LISTAS PEPS / PRP")]).toBe("NO");
    expect(v[col("HAY CONFLICTOS DE INTERÉS")]).toBe("NO");
    expect(v[col("QUEJAS O REPORTE DESDE INDECOPI")]).toBe("NO");
    expect(v[col("REGISTRA ANTECEDENTES EN OFAC")]).toBe("N.A.");
  });

  it("persona extranjera: listas celestes con su respuesta y las naranjas de persona en N.A.", () => {
    const v = filaMatrizExcel(
      fila({
        vinculo: {
          tipo: "representante",
          nombre: "PIZARRO ORTIZ CARMEN",
          ambito: "extranjero",
          pais: "CL",
          nacionalidad: null,
          listas: { ofac: "no", interpol: "si", conflicto_interes: "no" },
        },
      }),
    );
    expect(v[col("NACIONALIDAD (PERSONA)")]).toBe("Chile");
    expect(v[col("REGISTRA ANTECEDENTES EN OFAC")]).toBe("NO");
    expect(v[col("REGISTRA ANTECEDENTES EN INTERPOL")]).toBe("SI");
    expect(v[col("REGISTRA ANTECEDENTES EN DEA")]).toBe(""); // aplica, sin evaluar
    expect(v[col("LISTAS PEPS / PRP")]).toBe("N.A.");
    expect(v[col("HAY CONFLICTOS DE INTERÉS")]).toBe("NO");
  });

  it("empresa extranjera: Q-V en N.A. y celestes con sus respuestas", () => {
    const v = filaMatrizExcel(
      fila({
        empresa: { ambito: "extranjero", pais: "CL", listas: { ofac: "no" } },
        vinculo: { ambito: "extranjero", pais: "CL", listas: { ofac: "no" } },
      }),
    );
    expect(v[col("EMPRESA NACIONAL O EXTRANJERA")]).toBe("EXTRANJERA");
    expect(v[col("QUEJAS O REPORTE DESDE INDECOPI")]).toBe("N.A.");
    expect(v[col("REGISTRA ANTECEDENTES EN OFAC")]).toBe("NO");
  });

  it("conclusiones: etiquetas de negocio, fechas y resultado final", () => {
    const v = filaMatrizExcel(
      fila({
        vinculo: {
          sig: { fecha: "2026-10-20T12:00:00.000Z", responsable: "Gianella Neira", resultado: "observado", observaciones: "Hallazgo", conclusion: "requiere_dd_reforzada" },
          reputacional: { ...BLOQUE, resultado: "aceptado", conclusion: "sin_observaciones" },
          compliance: { ...BLOQUE, resultado: "aceptado", conclusion: "aceptado_con_observaciones" },
          resultadoFinal: "apto_con_observaciones",
        },
      }),
    );
    expect(v[col("RESULTADO DE LA EVALUACION POR SIG")]).toBe("OBSERVADO");
    expect(v[col("CONCLUSION DE SIG")]).toBe("REQUIERE DEBIDA DILIGENCIA REFORZADA");
    expect(v[col("RESPONSABLE DE REVISIÓN")]).toBe("Gianella Neira");
    expect(v[col("CONCLUSION REPUTACIONAL")]).toBe("SIN OBSERVACIONES");
    expect(v[col("CONCLUSION DE COMPLIANCE")]).toBe("ACEPTADO CON OBSERVACIONES");
    expect(v[col("RESULTADO FINAL")]).toBe("APTO CON OBSERVACIONES");
  });

  it("responsable y fecha de revision caen al expediente (importacion masiva con su etiqueta)", () => {
    const v = filaMatrizExcel(fila({}));
    expect(v[col("RESPONSABLE DE REVISIÓN")]).toBe("Importación masiva");
    expect((v[col("FECHA DE REVISIÓN POR SIG")] as Date).toISOString().slice(0, 10)).toBe("2026-10-19");
  });
});
