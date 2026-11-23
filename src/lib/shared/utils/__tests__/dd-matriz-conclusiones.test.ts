import { describe, expect, it } from "vitest";
import { pendientesPorExpediente, vinculosSinConclusionFinal } from "../dd-matriz-conclusiones";
import type { DdFilaConclusion } from "../dd-matriz-conclusiones";

const fila = (parcial: Partial<DdFilaConclusion>): DdFilaConclusion => ({
  id: "v1",
  expedienteId: "e1",
  nombre: "ACME",
  tipo: "empresa",
  sigResultado: "aceptado",
  sigConclusion: "sin_observaciones",
  repResultado: "aceptado",
  repConclusion: "sin_observaciones",
  ...parcial,
});

describe("vinculosSinConclusionFinal", () => {
  it("un vinculo con resultado y conclusion de SIG y Reputacional esta completo", () => {
    expect(vinculosSinConclusionFinal([fila({})])).toEqual([]);
  });
  it("detecta que falta la conclusion de SIG", () => {
    const r = vinculosSinConclusionFinal([fila({ sigConclusion: null })]);
    expect(r).toHaveLength(1);
    expect(r[0]?.faltan).toEqual(["sig"]);
  });
  it("detecta que falta el resultado aunque exista la conclusion", () => {
    expect(vinculosSinConclusionFinal([fila({ repResultado: null })])[0]?.faltan).toEqual(["reputacional"]);
  });
  it("detecta que faltan ambas areas y trata texto vacio como faltante", () => {
    const r = vinculosSinConclusionFinal([fila({ sigResultado: "  ", repConclusion: "" })]);
    expect(r[0]?.faltan).toEqual(["sig", "reputacional"]);
  });
  it("incluye a la empresa y conserva el orden de los vinculos", () => {
    const r = vinculosSinConclusionFinal([
      fila({ id: "a", nombre: "EMPRESA", sigResultado: null }),
      fila({ id: "b", nombre: "COMPLETO", tipo: "beneficiario" }),
      fila({ id: "c", nombre: "PERSONA", tipo: "beneficiario", repConclusion: null }),
    ]);
    expect(r.map((x) => x.id)).toEqual(["a", "c"]);
  });
});

describe("pendientesPorExpediente", () => {
  it("agrupa por expediente y omite los completos", () => {
    const mapa = pendientesPorExpediente([
      fila({ id: "a", expedienteId: "e1", sigResultado: null }),
      fila({ id: "b", expedienteId: "e2" }),
      fila({ id: "c", expedienteId: "e1", repResultado: null }),
    ]);
    expect([...mapa.keys()]).toEqual(["e1"]);
    expect(mapa.get("e1")?.map((x) => x.id)).toEqual(["a", "c"]);
  });
});
