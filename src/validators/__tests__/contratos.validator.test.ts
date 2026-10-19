import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { generarContratoSchema } from "../contratos.validator";
import { cuotasPredeterminadas } from "@/lib/shared/utils/cuotas";
import { dateUtils } from "@/lib/shared/utils/date";

const SOLICITUD_ID = "11111111-1111-4111-8111-111111111111";
const HOY = "2026-10-19";

function cuota(porcentaje: number, fechaVencimiento = "2026-11-15") {
  return { porcentaje, fechaVencimiento };
}

function cuotasFijas(cantidad: 1 | 2 | 3) {
  return (cuotasPredeterminadas(cantidad, HOY) ?? []).map((c) => cuota(c.porcentaje, c.fecha));
}

function parse(partial: Record<string, unknown>) {
  return generarContratoSchema.safeParse({ solicitudId: SOLICITUD_ID, ...partial });
}

beforeEach(() => {
  vi.spyOn(dateUtils, "todayLimaInputValue").mockReturnValue(HOY);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generarContratoSchema — cuotas fijas (RF-10)", () => {
  it("acepta una cuota al 100% con su fecha", () => {
    expect(parse({ cuotas: cuotasFijas(1) }).success).toBe(true);
  });

  it("acepta 50% + 50% con las fechas del cronograma", () => {
    expect(parse({ cuotas: cuotasFijas(2) }).success).toBe(true);
  });

  it("acepta la modalidad fija de 3 cuotas 40/30/30", () => {
    expect(parse({ cuotas: cuotasFijas(3) }).success).toBe(true);
  });

  it("rechaza porcentajes personalizados que no corresponden a una modalidad", () => {
    expect(parse({ cuotas: [cuota(33.33), cuota(33.33), cuota(33.34)] }).success).toBe(false);
  });

  it("rechaza una lista vacia", () => {
    expect(parse({ cuotas: [] }).success).toBe(false);
  });

  it("acepta 4 cuotas personalizadas con fechas futuras", () => {
    expect(parse({
      cuotas: [
        cuota(25, "2026-11-15"),
        cuota(25, "2027-01-15"),
        cuota(25, "2027-03-15"),
        cuota(25, "2027-06-15"),
      ],
    }).success).toBe(true);
  });

  it("rechaza porcentajes en cero o negativos", () => {
    expect(parse({ cuotas: [cuota(0), cuota(100)] }).success).toBe(false);
    expect(parse({ cuotas: [cuota(-10), cuota(110)] }).success).toBe(false);
  });

  it("rechaza porcentajes mayores a 100", () => {
    expect(parse({ cuotas: [cuota(101)] }).success).toBe(false);
  });

  it("rechaza sumas distintas de 100 y desviaciones de un centavo", () => {
    expect(parse({ cuotas: [cuota(50), cuota(49)] }).success).toBe(false);
    expect(parse({ cuotas: [cuota(50.01), cuota(25), cuota(24.98)] }).success).toBe(false);
  });

  it("rechaza porcentajes con mas de 2 decimales", () => {
    expect(parse({ cuotas: [cuota(33.333), cuota(33.333), cuota(33.334)] }).success).toBe(false);
  });

  it("rechaza valores no numericos", () => {
    expect(parse({ cuotas: [{ porcentaje: "50", fechaVencimiento: "2099-01-01" }] }).success).toBe(false);
    expect(parse({ cuotas: [cuota(Number.NaN)] }).success).toBe(false);
  });

  it("rechaza fechas pasadas", () => {
    expect(parse({ cuotas: [cuota(100, "2020-01-01")] }).success).toBe(false);
  });

  it("rechaza fechas con formato invalido", () => {
    expect(parse({ cuotas: [cuota(100, "01/02/2099")] }).success).toBe(false);
    expect(parse({ cuotas: [cuota(100, "2099-1-1")] }).success).toBe(false);
  });

  it("rechaza fechas fuera de orden cronologico", () => {
    expect(parse({ cuotas: cuotasFijas(2).reverse() }).success).toBe(false);
  });

  it("acepta un cronograma personalizado futuro; el servicio valida la configuracion de la empresa", () => {
    expect(parse({ cuotas: [cuota(100, "2026-11-16")] }).success).toBe(true);
    expect(parse({ cuotas: [cuota(50, "2026-11-15"), cuota(50, "2027-06-16")] }).success).toBe(true);
  });

  it("rechaza un solicitudId que no es uuid", () => {
    expect(generarContratoSchema.safeParse({ solicitudId: "abc", cuotas: [cuota(100)] }).success).toBe(false);
  });

  it("acepta idioma es|en y rechaza otros", () => {
    expect(parse({ cuotas: [cuota(100)], idioma: "en" }).success).toBe(true);
    expect(parse({ cuotas: [cuota(100)], idioma: "es" }).success).toBe(true);
    expect(parse({ cuotas: [cuota(100)], idioma: "pt" }).success).toBe(false);
    expect(parse({ cuotas: [cuota(100)] }).success).toBe(true);
  });

  it("acepta los datos del contrato del wizard (exhibidor) y rechaza campos largos", () => {
    const contrato = {
      razonSocial: "Minera Cordillera S.A.C.",
      ruc: "20601234567",
      direccion: "Av. Los Ingenieros 245, La Molina",
      representante: "Jorge Quispe Ramos",
      representanteDni: "45871233",
      partidaElectronica: "11014857",
    };
    expect(parse({ cuotas: [cuota(100)], contrato }).success).toBe(true);
    expect(parse({ cuotas: [cuota(100)], contrato: {} }).success).toBe(true);
    expect(parse({ cuotas: [cuota(100)], contrato: { ...contrato, representanteDni: "1".repeat(16) } }).success).toBe(false);
  });
});
