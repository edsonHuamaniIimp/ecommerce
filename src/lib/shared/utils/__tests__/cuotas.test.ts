import { describe, expect, it } from "vitest";
import { fechasCuotasValidas, planCuotas, planCuotasConFechas, planCuotasPorModalidad, porcentajesValidos, siguienteFechaCuota } from "../cuotas";
import { MODOS_PAGO } from "@/lib/shared/constants";

const BASE = new Date("2026-10-03T00:00:00");

describe("planCuotasConFechas (fechas del cliente)", () => {
  it("usa las fechas configuradas y calcula montos con redondeo exacto", () => {
    const plan = planCuotasConFechas(2360, [30, 30, 40], ["2026-11-15", "2026-12-20", "2027-01-30"]);
    expect(plan.map((c) => c.fechaVencimiento)).toEqual(["2026-11-15", "2026-12-20", "2027-01-30"]);
    expect(plan.map((c) => c.monto)).toEqual([708, 708, 944]);
  });
});

describe("siguienteFechaCuota", () => {
  it("primera cuota a 30 dias y siguientes a 45 dias", () => {
    expect(siguienteFechaCuota(null, BASE)).toBe("2026-11-02");
    expect(siguienteFechaCuota("2026-11-02", BASE)).toBe("2026-12-17");
  });
});

describe("fechasCuotasValidas", () => {
  const HOY = "2026-10-03";

  it("acepta fechas de hoy en adelante en orden ascendente", () => {
    expect(fechasCuotasValidas(["2026-10-03", "2026-11-02"], HOY)).toBe(true);
    expect(fechasCuotasValidas(["2099-01-01"], HOY)).toBe(true);
    expect(fechasCuotasValidas(["2026-11-02", "2026-11-02"], HOY)).toBe(true); // mismo dia permitido
  });

  it("rechaza fechas pasadas, invalidas o desordenadas", () => {
    expect(fechasCuotasValidas(["2026-10-02"], HOY)).toBe(false);
    expect(fechasCuotasValidas(["01/11/2026"], HOY)).toBe(false);
    expect(fechasCuotasValidas([null], HOY)).toBe(false);
    expect(fechasCuotasValidas(["2026-12-01", "2026-11-01"], HOY)).toBe(false);
  });
});

describe("planCuotas", () => {
  it("configura hasta 3 cuotas con porcentajes del cliente y ajusta el redondeo", () => {
    const plan = planCuotas(2360, [30, 30, 40], BASE);
    expect(plan.map((c) => c.monto)).toEqual([708, 708, 944]);
    expect(plan.map((c) => c.porcentaje)).toEqual([30, 30, 40]);
    expect(plan[0]?.fechaVencimiento).toBe("2026-11-02");
    expect(plan[1]?.fechaVencimiento).toBe("2026-12-17");
    expect(plan[2]?.fechaVencimiento).toBe("2027-01-31");
  });

  it("la suma de los montos es exactamente el total en casos de redondeo", () => {
    const casos: Array<[number, number[]]> = [
      [100, [33.33, 33.33, 33.34]],
      [0.03, [33.33, 33.33, 33.34]],
      [9999.99, [33.33, 33.33, 33.34]],
      [1, [1, 99]],
      [2360, [0.01, 99.99]],
      [2000, [100]],
    ];
    for (const [total, porcentajes] of casos) {
      const plan = planCuotas(total, porcentajes, BASE);
      const suma = Math.round(plan.reduce((s, c) => s + c.monto, 0) * 100) / 100;
      expect(suma, `total=${total} cuotas=${porcentajes.join("/")}`).toBeCloseTo(total, 2);
    }
  });
});

describe("porcentajesValidos", () => {
  it("acepta 1 a 3 cuotas que suman 100%", () => {
    expect(porcentajesValidos([100])).toBe(true);
    expect(porcentajesValidos([50, 50])).toBe(true);
    expect(porcentajesValidos([30, 30, 40])).toBe(true);
  });

  it("rechaza suma distinta de 100, valores no positivos o mas de 3 cuotas", () => {
    expect(porcentajesValidos([50, 40])).toBe(false);
    expect(porcentajesValidos([0, 100])).toBe(false);
    expect(porcentajesValidos([10, 10, 10, 70])).toBe(false);
  });
});

describe("planCuotasPorModalidad", () => {
  it("pago completo: 1 cuota al 100% a 30 dias", () => {
    const plan = planCuotasPorModalidad(2360, MODOS_PAGO.COMPLETO, BASE);
    expect(plan).toEqual([
      { numero: 1, porcentaje: 100, monto: 2360, fechaVencimiento: "2026-11-02" },
    ]);
  });

  it("cuotas: 50/50 (segunda a los 45 dias de la primera)", () => {
    const plan = planCuotasPorModalidad(2360, MODOS_PAGO.CUOTAS, BASE);
    expect(plan).toEqual([
      { numero: 1, porcentaje: 50, monto: 1180, fechaVencimiento: "2026-11-02" },
      { numero: 2, porcentaje: 50, monto: 1180, fechaVencimiento: "2026-12-17" },
    ]);
  });

  it("ajusta el redondeo para que la suma cuadre con el total", () => {
    const plan = planCuotasPorModalidad(2001, MODOS_PAGO.CUOTAS, BASE);
    const suma = plan.reduce((s, c) => s + c.monto, 0);
    expect(suma).toBe(2001);
    expect(plan[0]?.monto).toBe(1000.5);
    expect(plan[1]?.monto).toBe(1000.5);
  });
});
