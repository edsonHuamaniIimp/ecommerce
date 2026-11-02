import { describe, it, expect } from "vitest";
import { areasRevisionLocal, legalDelegadaAlSgc, observadaPorArea, origenesObservacion, tieneLegalLocal } from "../revision-areas";
import { RESULTADOS_APROBACION, REVISION_AREAS, SGC_LIFECYCLE_STATUSES } from "@/lib/shared/constants";

describe("revision-areas (flujo local Asociado vs SGC, RF-14/15)", () => {
  it("deberia considerar solo Asociado como nivel local en una solicitud nueva", () => {
    const revisiones = [{ area: REVISION_AREAS.ASOCIADO }];

    expect(areasRevisionLocal(revisiones)).toEqual([REVISION_AREAS.ASOCIADO]);
    expect(tieneLegalLocal(revisiones)).toBe(false);
    expect(legalDelegadaAlSgc(revisiones)).toBe(true);
  });

  it("deberia mantener la revision Legal local para datos legacy", () => {
    const revisiones = [{ area: REVISION_AREAS.ASOCIADO }, { area: REVISION_AREAS.LEGAL }];

    expect(areasRevisionLocal(revisiones)).toEqual([
      REVISION_AREAS.ASOCIADO,
      REVISION_AREAS.LEGAL,
    ]);
    expect(tieneLegalLocal(revisiones)).toBe(true);
    expect(legalDelegadaAlSgc(revisiones)).toBe(false);
  });

  it("deberia considerar solo el orden vigente si no hay revisiones", () => {
    expect(areasRevisionLocal([])).toEqual([REVISION_AREAS.ASOCIADO]);
    expect(legalDelegadaAlSgc([])).toBe(true);
  });

  it("agrega Legal local cuando el SGC esta deshabilitado", () => {
    expect(areasRevisionLocal([{ area: REVISION_AREAS.ASOCIADO }], { sgcEnabled: false })).toEqual([
      REVISION_AREAS.ASOCIADO,
      REVISION_AREAS.LEGAL,
    ]);
    expect(areasRevisionLocal([], { sgcEnabled: true })).toEqual([REVISION_AREAS.ASOCIADO]);
  });
});

describe("origen de la observacion", () => {
  it("distingue Asociado y Legal local sin cambiar estados", () => {
    expect(origenesObservacion({
      revisiones: [
        { area: REVISION_AREAS.ASOCIADO, estado: RESULTADOS_APROBACION.OBSERVADO },
        { area: REVISION_AREAS.LEGAL, estado: RESULTADOS_APROBACION.OBSERVADO },
      ],
    })).toEqual(["asociado", "legal"]);
  });

  it("incluye SGC como Legal cuando exige cambio documental", () => {
    const row = {
      revisiones: [{ area: REVISION_AREAS.ASOCIADO, estado: RESULTADOS_APROBACION.APROBADO }],
      sgcLifecycleStatus: SGC_LIFECYCLE_STATUSES.REJECTED,
      sgcDevolucionRequiereCambio: true,
    };
    expect(origenesObservacion(row)).toEqual(["sgc"]);
    expect(observadaPorArea(row, "legal")).toBe(true);
    expect(observadaPorArea(row, "asociado")).toBe(false);
  });

  it("no reinterpreta rechazos legacy sin flag de cambio", () => {
    expect(origenesObservacion({
      revisiones: [{ area: REVISION_AREAS.ASOCIADO, estado: RESULTADOS_APROBACION.APROBADO }],
      sgcLifecycleStatus: SGC_LIFECYCLE_STATUSES.REJECTED,
      sgcDevolucionRequiereCambio: null,
    })).toEqual([]);
  });
});
