import { describe, expect, it } from "vitest";
import { configCuotasValida, cronogramaPredeterminado, cronogramaValido, cuotasCoincidenConfig, cuotasPersonalizadasIniciales, cuotasPredeterminadas, fechasCuotasEnRango, fechasCuotasValidas, fechaMaximaCuota, modalidadDeCuotas, planCuotas, planCuotasConFechas, planCuotasPorModalidad, planPagoPredeterminado, porcentajesEquitativos, porcentajesValidos, siguienteFechaCuota, sumarMesesISO } from "../cuotas";
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
    expect(fechasCuotasValidas(["2026-11-02", "2026-11-03"], HOY)).toBe(true); // un dia despues: posterior valida
  });

  it("rechaza fechas pasadas, invalidas, desordenadas o no posteriores", () => {
    expect(fechasCuotasValidas(["2026-10-02"], HOY)).toBe(false);
    expect(fechasCuotasValidas(["01/11/2026"], HOY)).toBe(false);
    expect(fechasCuotasValidas([null], HOY)).toBe(false);
    expect(fechasCuotasValidas(["2026-12-01", "2026-11-01"], HOY)).toBe(false);
    expect(fechasCuotasValidas(["2026-11-02", "2026-11-02"], HOY)).toBe(false); // mismo dia: debe ser posterior
  });
});

describe("sumarMesesISO", () => {
  it("suma meses recortando al ultimo dia del mes destino", () => {
    expect(sumarMesesISO("2026-10-03", 1)).toBe("2026-11-03");
    expect(sumarMesesISO("2026-01-31", 1)).toBe("2026-02-28");
    expect(sumarMesesISO("2026-10-15", 3)).toBe("2027-01-15");
  });
});

describe("fechaMaximaCuota (cuota N: N meses desde la solicitud, tope 15/07/2027)", () => {
  it("calcula el maximo de cada cuota desde la fecha base", () => {
    expect(fechaMaximaCuota(0, BASE)).toBe("2026-11-03");
    expect(fechaMaximaCuota(1, BASE)).toBe("2026-12-03");
    expect(fechaMaximaCuota(2, BASE)).toBe("2027-01-03");
  });

  it("aplica el tope absoluto del cronograma", () => {
    expect(fechaMaximaCuota(2, new Date("2027-06-20T00:00:00"))).toBe("2027-07-15");
  });
});

describe("fechasCuotasEnRango", () => {
  it("acepta fechas dentro del maximo de cada cuota", () => {
    expect(fechasCuotasEnRango([fechaMaximaCuota(0, BASE)], BASE)).toBe(true);
    expect(fechasCuotasEnRango([fechaMaximaCuota(0, BASE), fechaMaximaCuota(1, BASE)], BASE)).toBe(true);
  });

  it("rechaza una fecha posterior al maximo de su cuota o vacia", () => {
    expect(fechasCuotasEnRango(["2026-11-04"], BASE)).toBe(false);
    expect(fechasCuotasEnRango([fechaMaximaCuota(0, BASE), "2026-12-04"], BASE)).toBe(false);
    expect(fechasCuotasEnRango([null], BASE)).toBe(false);
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

  it("acepta hasta 9 cuotas cuando la configuracion personalizada lo permite", () => {
    expect(porcentajesValidos([10, 10, 10, 10, 10, 10, 10, 10, 20], 9)).toBe(true);
    expect(porcentajesValidos([10, 10, 10, 10, 10, 10, 10, 10, 10, 10], 9)).toBe(false);
    expect(porcentajesValidos([10, 10, 10, 10, 10, 10, 10, 10, 20])).toBe(false);
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

describe("cronograma fijo PERUMIN 38", () => {
  it("asigna la modalidad de 1 cuota segun la fecha de reserva", () => {
    expect(cronogramaPredeterminado(1, "2026-10-19")).toEqual(["2026-11-15"]);
    expect(cronogramaPredeterminado(1, "2026-11-15")).toEqual(["2027-06-15"]);
    expect(cronogramaPredeterminado(1, "2027-06-15")).toBeNull();
  });

  it("asigna la modalidad de 2 cuotas y salta el hito vencido", () => {
    expect(cronogramaPredeterminado(2, "2026-10-19")).toEqual(["2026-11-15", "2027-06-15"]);
    expect(cronogramaPredeterminado(2, "2026-11-15")).toEqual(["2027-01-15", "2027-06-15"]);
    expect(cronogramaPredeterminado(2, "2027-01-15")).toEqual(["2027-03-15", "2027-06-15"]);
    expect(cronogramaPredeterminado(2, "2027-03-15")).toBeNull();
  });

  it("asigna la modalidad de 3 cuotas solo mientras sus fechas sean futuras", () => {
    expect(cronogramaPredeterminado(3, "2026-10-19")).toEqual(["2026-11-15", "2027-02-15", "2027-06-15"]);
    expect(cronogramaPredeterminado(3, "2026-11-15")).toEqual(["2027-01-15", "2027-03-15", "2027-06-15"]);
    expect(cronogramaPredeterminado(3, "2027-01-15")).toBeNull();
    expect(cronogramaPredeterminado(3, "2027-02-01")).toBeNull();
  });

  it("calcula 40/30/30 y redondea la ultima cuota", () => {
    const plan = planPagoPredeterminado(2360, 3, "2026-10-19");
    expect(plan?.map((c) => c.porcentaje)).toEqual([40, 30, 30]);
    expect(plan?.map((c) => c.monto)).toEqual([944, 708, 708]);
    expect(plan?.map((c) => c.fechaVencimiento)).toEqual(["2026-11-15", "2027-02-15", "2027-06-15"]);
  });

  it("rechaza planes con porcentajes o fechas libres", () => {
    const validas = cuotasPredeterminadas(3, "2026-10-19") ?? [];
    expect(cronogramaValido(validas.map((c) => ({ porcentaje: c.porcentaje, fechaVencimiento: c.fecha })), "2026-10-19")).toBe(true);
    expect(cronogramaValido([
      { porcentaje: 30, fechaVencimiento: "2026-11-15" },
      { porcentaje: 30, fechaVencimiento: "2027-02-15" },
      { porcentaje: 40, fechaVencimiento: "2027-06-15" },
    ], "2026-10-19")).toBe(false);
    expect(cronogramaValido([
      { porcentaje: 40, fechaVencimiento: "2026-11-16" },
      { porcentaje: 30, fechaVencimiento: "2027-02-15" },
      { porcentaje: 30, fechaVencimiento: "2027-06-15" },
    ], "2026-10-19")).toBe(false);
  });

  it("clasifica las modalidades contractuales", () => {
    expect(modalidadDeCuotas([100])).toBe(MODOS_PAGO.COMPLETO);
    expect(modalidadDeCuotas([50, 50])).toBe(MODOS_PAGO.CUOTAS);
    expect(modalidadDeCuotas([40, 30, 30])).toBe(MODOS_PAGO.TRES_CUOTAS);
    expect(modalidadDeCuotas([25, 35, 40])).toBe(MODOS_PAGO.PERSONALIZADO);
  });
});

describe("configuracion personalizada de cuotas por empresa", () => {
  const CONFIG = { maxCuotas: 3, fechas: ["2026-11-15", "2027-02-15", "2027-06-15"] };

  it("valida cantidad, formato, futuro y orden", () => {
    expect(configCuotasValida(CONFIG, "2026-10-19")).toBe(true);
    expect(configCuotasValida({ maxCuotas: 4, fechas: ["2026-11-15", "2027-01-15", "2027-03-15", "2027-06-15"] }, "2026-10-19")).toBe(true);
    expect(configCuotasValida({ maxCuotas: 9, fechas: ["2026-11-15", "2026-12-15", "2027-01-15", "2027-02-15", "2027-03-15", "2027-04-15", "2027-05-15", "2027-06-15", "2027-07-15"] }, "2026-10-19")).toBe(true);
    expect(configCuotasValida({ maxCuotas: 10, fechas: Array.from({ length: 10 }, (_, i) => `2027-${String(i + 1).padStart(2, "0")}-15`) }, "2026-10-19")).toBe(false);
    expect(configCuotasValida({ maxCuotas: 2, fechas: ["2026-11-15"] }, "2026-10-19")).toBe(false);
    expect(configCuotasValida({ maxCuotas: 2, fechas: ["2026-11-15", "2026-11-14"] }, "2026-10-19")).toBe(false);
    expect(configCuotasValida({ maxCuotas: 1, fechas: ["2026-10-19"] }, "2026-10-19")).toBe(false);
  });

  it("genera porcentajes equitativos y acepta cualquier distribucion valida", () => {
    expect(porcentajesEquitativos(3)).toEqual([33.33, 33.33, 33.34]);
    expect(porcentajesEquitativos(2)).toEqual([50, 50]);
    expect(cuotasCoincidenConfig([
      { porcentaje: 50, fechaVencimiento: "2026-11-15" },
      { porcentaje: 30, fechaVencimiento: "2027-02-15" },
      { porcentaje: 20, fechaVencimiento: "2027-06-15" },
    ], CONFIG, "2026-10-19")).toBe(true);
    expect(cuotasCoincidenConfig([
      { porcentaje: 50, fechaVencimiento: "2026-11-16" },
      { porcentaje: 30, fechaVencimiento: "2027-02-15" },
      { porcentaje: 20, fechaVencimiento: "2027-06-15" },
    ], CONFIG, "2026-10-19")).toBe(false);
  });

  it("inicializa las cuotas con las fechas configuradas", () => {
    expect(cuotasPersonalizadasIniciales(CONFIG, "2026-10-19")).toEqual([
      { porcentaje: 33.33, fecha: "2026-11-15" },
      { porcentaje: 33.33, fecha: "2027-02-15" },
      { porcentaje: 33.34, fecha: "2027-06-15" },
    ]);
  });
});
