import { describe, expect, it } from "vitest";
import { DD_MATRIZ_FILTRO_FECHA } from "@/lib/shared/constants";
import { rangoDeFiltroFecha } from "@/lib/shared/utils/dd-matriz-filtro-fecha";

const HOY = "2026-03-01";

describe("rangoDeFiltroFecha", () => {
  it("todos no filtra", () => {
    expect(rangoDeFiltroFecha(DD_MATRIZ_FILTRO_FECHA.TODOS, {}, HOY)).toEqual({});
  });
  it("hoy y ayer (cruzando de mes)", () => {
    expect(rangoDeFiltroFecha(DD_MATRIZ_FILTRO_FECHA.HOY, {}, HOY)).toEqual({ fechaDesde: HOY, fechaHasta: HOY });
    expect(rangoDeFiltroFecha(DD_MATRIZ_FILTRO_FECHA.AYER, {}, HOY)).toEqual({ fechaDesde: "2026-02-28", fechaHasta: "2026-02-28" });
  });
  it("ultimos 7 dias incluye hoy y los 6 anteriores", () => {
    expect(rangoDeFiltroFecha(DD_MATRIZ_FILTRO_FECHA.SEMANA, {}, HOY)).toEqual({ fechaDesde: "2026-02-23", fechaHasta: HOY });
  });
  it("este mes parte del dia 1", () => {
    expect(rangoDeFiltroFecha(DD_MATRIZ_FILTRO_FECHA.MES, {}, "2026-11-23")).toEqual({ fechaDesde: "2026-11-01", fechaHasta: "2026-11-23" });
  });
  it("rango usa las fechas elegidas, admite una sola punta y reordena si estan invertidas", () => {
    expect(rangoDeFiltroFecha(DD_MATRIZ_FILTRO_FECHA.RANGO, { fechaDesde: "2026-01-05" }, HOY)).toEqual({ fechaDesde: "2026-01-05", fechaHasta: undefined });
    expect(rangoDeFiltroFecha(DD_MATRIZ_FILTRO_FECHA.RANGO, { fechaDesde: "2026-02-10", fechaHasta: "2026-01-05" }, HOY)).toEqual({ fechaDesde: "2026-01-05", fechaHasta: "2026-02-10" });
  });
});
