import { describe, expect, it } from "vitest";
import { validarEmpresaReservaAdministrativa } from "../reserva-admin-readiness";

const EMPRESA_COMPLETA = {
  razonSocial: "ABASTECEDORES Y SERVICIOS INDUSTRIALES S.A.",
  ruc: "20102026471",
  direccionFiscal: "Av. Prueba 123",
  representanteUserId: "user-rep",
  representanteLegalNombre: "ALVA ALFARO CARLOS",
  representanteLegalDni: "12345678",
  representanteCorreo: "rep@empresa.pe",
  emailContacto: "contacto@empresa.pe",
  emailFacturacion: "facturas@empresa.pe",
};

const SIN_FALTANTES = {
  ok: true,
  faltantes: [],
  faltantesEmpresa: [],
  faltantesRepresentante: [],
  faltantesGenerales: [],
  faltantesPago: [],
};

describe("validarEmpresaReservaAdministrativa", () => {
  it("acepta una empresa completa para factura y boleta", () => {
    expect(validarEmpresaReservaAdministrativa(EMPRESA_COMPLETA, "factura", "USD")).toEqual(SIN_FALTANTES);
    expect(validarEmpresaReservaAdministrativa(EMPRESA_COMPLETA, "boleta", "PEN")).toEqual(SIN_FALTANTES);
  });

  it("agrupa los faltantes por empresa y representante legal", () => {
    const resultado = validarEmpresaReservaAdministrativa({}, "factura", "");
    expect(resultado.ok).toBe(false);
    expect(resultado.faltantesEmpresa).toEqual(expect.arrayContaining([
      "razón social",
      "RUC de 11 dígitos",
      "dirección fiscal",
      "correo de facturación",
    ]));
    expect(resultado.faltantesRepresentante).toEqual(expect.arrayContaining([
      "cuenta vinculada",
      "nombre",
      "documento",
    ]));
    expect(resultado.faltantesPago).toContain("tipo de pago");
    expect(resultado.faltantes).toEqual(expect.arrayContaining([
      "Empresa: razón social",
      "Representante legal: documento",
      "Pago: tipo de pago",
    ]));
  });

  it("exige DNI de 8 dígitos cuando el comprobante es boleta", () => {
    const resultado = validarEmpresaReservaAdministrativa(
      { ...EMPRESA_COMPLETA, representanteLegalDni: "20102026471" },
      "boleta",
      "USD",
    );
    expect(resultado.ok).toBe(false);
    expect(resultado.faltantesRepresentante).toContain("DNI de 8 dígitos para la boleta");
  });
});
