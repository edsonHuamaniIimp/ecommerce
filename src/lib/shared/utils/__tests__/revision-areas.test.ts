import { describe, it, expect } from "vitest";
import { areasRevisionLocal, legalDelegadaAlSgc, tieneLegalLocal } from "../revision-areas";
import { REVISION_AREAS } from "@/lib/shared/constants";

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
});
