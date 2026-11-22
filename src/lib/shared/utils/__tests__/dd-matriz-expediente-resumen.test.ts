import { describe, expect, it } from "vitest";
import { resumenArea, resumenesPorExpediente } from "../dd-matriz-expediente-resumen";
import type { DdMatrizEvaluacionFilaDTO } from "@/types/dto/debida-diligencia";

function fila(parcial: Partial<DdMatrizEvaluacionFilaDTO>): DdMatrizEvaluacionFilaDTO {
  return {
    id: "v1",
    expedienteId: "e1",
    eventoId: "ev",
    eventoLabel: "Perumin 2027",
    codigo: "DD-2026-0001",
    expedienteEstado: "en_revision",
    empresaRazonSocial: "ACME SAC",
    empresaRuc: "20123456789",
    motivo: null,
    eventoProyecto: null,
    fechaIngreso: "2026-11-01T00:00:00.000Z",
    tipo: "empresa",
    origen: "automatico",
    nombre: "ACME SAC",
    tipoDocumento: "RUC",
    documento: "20123456789",
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
    ...parcial,
  } as DdMatrizEvaluacionFilaDTO;
}

describe("resumenArea", () => {
  it("pendiente cuando nadie evaluo", () => {
    expect(resumenArea([null, null])).toEqual({ estado: "pendiente", evaluados: 0, total: 2 });
  });
  it("parcial cuando faltan vinculos", () => {
    expect(resumenArea(["aceptado", null])).toMatchObject({ estado: "parcial", evaluados: 1, total: 2 });
  });
  it("aceptado cuando todos estan evaluados sin observaciones", () => {
    expect(resumenArea(["aceptado", "aceptado"])).toMatchObject({ estado: "aceptado" });
  });
  it("observado si alguno lo esta, aunque falten otros", () => {
    expect(resumenArea(["observado", null, "aceptado"])).toMatchObject({ estado: "observado", evaluados: 2 });
    expect(resumenArea(["con_hallazgos"])).toMatchObject({ estado: "observado" });
  });
});

describe("resumenesPorExpediente", () => {
  it("agrupa por expediente y toma la fila de la empresa", () => {
    const filas = [
      fila({ id: "p1", tipo: "representante", nombre: "JUAN", sigResultado: "observado" }),
      fila({ id: "emp", resultadoFinal: "apto", sigResultado: "aceptado" }),
      fila({ id: "otro", expedienteId: "e2", codigo: "DD-2026-0002", empresaRazonSocial: "BETA SAC" }),
    ];
    const resumenes = resumenesPorExpediente(filas);
    expect(resumenes).toHaveLength(2);
    const acme = resumenes.find((r) => r.expedienteId === "e1")!;
    expect(acme.empresaVinculoId).toBe("emp");
    expect(acme.totalVinculos).toBe(2);
    expect(acme.vinculosObservados).toBe(1);
    expect(acme.sig.estado).toBe("observado");
    expect(acme.vinculoIds).toEqual(["p1", "emp"]);
    expect(acme.conclusionFinal).toBe("apto");
  });

  it("usa el estado del expediente cuando no hay conclusion guardada", () => {
    const [resumen] = resumenesPorExpediente([fila({ expedienteEstado: "aprobada" })]);
    expect(resumen?.conclusionFinal).toBe("apto");
  });
});
