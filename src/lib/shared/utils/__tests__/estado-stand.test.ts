import { describe, it, expect } from "vitest";
import { esEmpresaDuenaPreReserva, esStandNoDisponible } from "../estado-stand";
import { ESTADOS_STAND, ESTADOS_STAND_LEGACY } from "@/lib/shared/constants";

describe("esEmpresaDuenaPreReserva", () => {
  const stand = {
    preReservaRuc: "20123456789",
    preReservaSie: "E0000000123",
    preReservaRazonSocial: "Minera Cordillera S.A.C.",
  };

  it("coincide por RUC (con espacios)", () => {
    expect(esEmpresaDuenaPreReserva(stand, { ruc: " 20123456789 " })).toBe(true);
  });

  it("coincide por SIE sin distinguir mayusculas", () => {
    expect(esEmpresaDuenaPreReserva(stand, { sieCode: "e0000000123" })).toBe(true);
  });

  it("coincide por razon social normalizada (tildes/mayusculas/espacios)", () => {
    expect(
      esEmpresaDuenaPreReserva(stand, { razonSocial: "MINERA   CORDILLERA   S.A.C." }),
    ).toBe(true);
    expect(
      esEmpresaDuenaPreReserva({ preReservaRazonSocial: "Minería Andina" }, { razonSocial: "mineria andina" }),
    ).toBe(true);
  });

  it("no coincide con otra empresa ni con un viewer vacio", () => {
    expect(
      esEmpresaDuenaPreReserva(stand, { ruc: "20999999999", razonSocial: "Otra Empresa S.A.C." }),
    ).toBe(false);
    expect(esEmpresaDuenaPreReserva(stand, {})).toBe(false);
  });

  it("no coincide si la pre-reserva no tiene datos de empresa (solo titulo)", () => {
    expect(
      esEmpresaDuenaPreReserva(
        { preReservaRuc: null, preReservaSie: null, preReservaRazonSocial: null },
        { ruc: "20123456789", razonSocial: "Minera Cordillera S.A.C." },
      ),
    ).toBe(false);
  });
});

describe("esStandNoDisponible", () => {
  it("disponible (canonico y legacy available) se puede reservar", () => {
    expect(esStandNoDisponible(ESTADOS_STAND.DISPONIBLE)).toBe(false);
    expect(esStandNoDisponible(ESTADOS_STAND_LEGACY.AVAILABLE)).toBe(false);
    expect(esStandNoDisponible(null)).toBe(false);
    expect(esStandNoDisponible(undefined)).toBe(false);
    expect(esStandNoDisponible("")).toBe(false);
  });

  it("todos los estados canonicos no disponibles bloquean", () => {
    expect(esStandNoDisponible(ESTADOS_STAND.EN_PROCESO)).toBe(true);
    expect(esStandNoDisponible(ESTADOS_STAND.EN_EVALUACION)).toBe(true);
    expect(esStandNoDisponible(ESTADOS_STAND.RESERVADO)).toBe(true);
    expect(esStandNoDisponible(ESTADOS_STAND.PRE_RESERVADO)).toBe(true);
  });

  it("estados heredados de GESS/KB bloquean", () => {
    expect(esStandNoDisponible(ESTADOS_STAND_LEGACY.RESERVADO)).toBe(true);
    expect(esStandNoDisponible(ESTADOS_STAND_LEGACY.EN_EVALUACION)).toBe(true);
    expect(esStandNoDisponible(ESTADOS_STAND_LEGACY.RESERVED)).toBe(true);
  });
});
