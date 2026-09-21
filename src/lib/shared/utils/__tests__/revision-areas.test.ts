import { describe, it, expect } from "vitest";
import { areasRevisionLocal, legalDelegadaAlSgc, tieneLegalLocal } from "../revision-areas";
import { REVISION_AREAS } from "@/lib/shared/constants";

describe("revision-areas (compatibilidad flujo local vs SGC)", () => {
  it("deberia considerar solo logistica y comunicacion en una solicitud nueva", () => {
    const revisiones = [{ area: REVISION_AREAS.LOGISTICA }, { area: REVISION_AREAS.COMUNICACION }];

    expect(areasRevisionLocal(revisiones)).toEqual([REVISION_AREAS.LOGISTICA, REVISION_AREAS.COMUNICACION]);
    expect(tieneLegalLocal(revisiones)).toBe(false);
    expect(legalDelegadaAlSgc(revisiones)).toBe(true);
  });

  it("deberia mantener la revision Legal local para datos legacy", () => {
    const revisiones = [
      { area: REVISION_AREAS.LOGISTICA },
      { area: REVISION_AREAS.COMUNICACION },
      { area: REVISION_AREAS.LEGAL },
    ];

    expect(areasRevisionLocal(revisiones)).toEqual([
      REVISION_AREAS.LOGISTICA,
      REVISION_AREAS.COMUNICACION,
      REVISION_AREAS.LEGAL,
    ]);
    expect(tieneLegalLocal(revisiones)).toBe(true);
    expect(legalDelegadaAlSgc(revisiones)).toBe(false);
  });

  it("deberia considerar solo el orden vigente si no hay revisiones", () => {
    expect(areasRevisionLocal([])).toEqual([REVISION_AREAS.LOGISTICA, REVISION_AREAS.COMUNICACION]);
    expect(legalDelegadaAlSgc([])).toBe(true);
  });
});
