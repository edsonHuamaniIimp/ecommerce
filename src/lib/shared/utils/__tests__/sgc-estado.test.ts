import { describe, it, expect } from "vitest";
import { puedeGenerarOrdenPago, sgcAplica, sgcAprobado } from "../sgc-estado";
import { SGC_LIFECYCLE_STATUSES } from "@/lib/shared/constants";

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

  it("permite orden de pago si el SGC no aplica", () => {
    expect(puedeGenerarOrdenPago(null, null)).toBe(true);
  });

  it("bloquea la orden de pago hasta que el SGC apruebe", () => {
    expect(puedeGenerarOrdenPago("creado", null)).toBe(false);
    expect(puedeGenerarOrdenPago("creado", SGC_LIFECYCLE_STATUSES.OBSERVED)).toBe(false);
    expect(puedeGenerarOrdenPago("creado", SGC_LIFECYCLE_STATUSES.ACTIVE)).toBe(true);
  });
});
