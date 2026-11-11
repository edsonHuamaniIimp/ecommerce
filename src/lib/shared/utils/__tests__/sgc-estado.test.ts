import { describe, it, expect } from "vitest";
import { puedeGenerarOrdenPago, sgcAplica, sgcAprobado, sgcEnRevisionLegal } from "../sgc-estado";
import { SGC_LIFECYCLE_STATUSES, SGC_STAGES } from "@/lib/shared/constants";

describe("sgc-estado", () => {
  it("sgcAplica es false sin expediente y true si existe correlacion", () => {
    expect(sgcAplica(null)).toBe(false);
    expect(sgcAplica("creado")).toBe(true);
    expect(sgcAplica("pendiente")).toBe(true);
  });

  it("sgcAprobado solo cuando el contrato esta Vigente", () => {
    expect(sgcAprobado(SGC_LIFECYCLE_STATUSES.ACTIVE)).toBe(true);
    expect(sgcAprobado(SGC_LIFECYCLE_STATUSES.OBSERVED)).toBe(false);
    expect(sgcAprobado(null)).toBe(false);
  });

  it("detecta el expediente en revision Legal del SGC", () => {
    expect(sgcEnRevisionLegal(SGC_STAGES.INTERNAL_REVIEW, null)).toBe(true);
    expect(sgcEnRevisionLegal(SGC_STAGES.INTERNAL_REVIEW, SGC_LIFECYCLE_STATUSES.OBSERVED)).toBe(false);
    expect(sgcEnRevisionLegal(SGC_STAGES.INTERNAL_REVIEW, SGC_LIFECYCLE_STATUSES.REJECTED)).toBe(false);
    expect(sgcEnRevisionLegal(SGC_STAGES.APPROVAL, null)).toBe(false);
    expect(sgcEnRevisionLegal(null, null)).toBe(false);
  });

  it("permite orden de pago cuando Legal es local (no delegada)", () => {
    expect(puedeGenerarOrdenPago(false, null)).toBe(true);
  });

  it("bloquea la orden de pago hasta que el SGC apruebe cuando Legal esta delegada", () => {
    expect(puedeGenerarOrdenPago(true, null)).toBe(false);
    expect(puedeGenerarOrdenPago(true, SGC_LIFECYCLE_STATUSES.OBSERVED)).toBe(false);
    expect(puedeGenerarOrdenPago(true, SGC_LIFECYCLE_STATUSES.ACTIVE)).toBe(true);
  });
});
