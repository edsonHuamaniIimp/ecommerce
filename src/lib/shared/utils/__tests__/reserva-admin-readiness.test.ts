import { describe, expect, it } from "vitest";
import { TIPOS_COMPROBANTE, TIPOS_DOCUMENTO_EMPRESA } from "@/lib/shared/constants";
import { validarEmpresaReservaAdministrativa } from "../reserva-admin-readiness";

function empresa(overrides: Record<string, unknown> = {}) {
  return {
    razonSocial: "ITALIAN TRADE AGENCY",
    ruc: "699035009",
    tipoDocumento: TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO,
    pais: "IT",
    direccionFiscal: "Via Roma 1",
    representanteUserId: "user-1",
    representanteLegalNombre: "Eliana Zappala",
    representanteLegalDni: "AY1234567",
    representanteCorreo: "eliana@example.it",
    emailContacto: null,
    emailFacturacion: null,
    ...overrides,
  } as never;
}

describe("validarEmpresaReservaAdministrativa", () => {
  it("acepta un RUT no domiciliado y su correo", () => {
    const resultado = validarEmpresaReservaAdministrativa(
      empresa(),
      TIPOS_COMPROBANTE.FACTURA,
      "USD",
    );

    expect(resultado.ok).toBe(true);
    expect(resultado.faltantesEmpresa.some((f) => f.startsWith("RUC de 11"))).toBe(false);
  });

  it("rechaza un RUC que no tiene 11 digitos", () => {
    const resultado = validarEmpresaReservaAdministrativa(
      empresa({ tipoDocumento: TIPOS_DOCUMENTO_EMPRESA.RUC, ruc: "699035009" }),
      TIPOS_COMPROBANTE.FACTURA,
      "USD",
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.faltantesEmpresa.some((f) => f.startsWith("RUC de 11"))).toBe(true);
  });

  it("rechaza una empresa sin correo", () => {
    const resultado = validarEmpresaReservaAdministrativa(
      empresa({ representanteCorreo: null, emailContacto: null, emailFacturacion: null }),
      TIPOS_COMPROBANTE.FACTURA,
      "USD",
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.faltantesEmpresa.some((f) => f.startsWith("correo de facturaci"))).toBe(true);
  });
});
