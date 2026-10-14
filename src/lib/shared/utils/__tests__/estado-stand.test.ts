import { describe, it, expect } from "vitest";
import { esEmpresaDuenaPreReserva } from "../estado-stand";

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
