import { describe, expect, it } from "vitest";
import { TIPOS_DOCUMENTO_EMPRESA } from "@/lib/shared/constants";
import { actualizarEmpresaSchema, crearEmpresaSchema, validarDatosEmpresaSchema } from "../empresas.validator";

describe("crearEmpresaSchema (documento RUC o RUT)", () => {
  it("acepta un RUC de 11 digitos (autodetectado)", () => {
    const r = crearEmpresaSchema.safeParse({ ruc: "20601234567", razonSocial: "Minera Demo S.A.C." });
    expect(r.success).toBe(true);
  });

  it("acepta un RUT alfanumerico autodetectado", () => {
    const r = crearEmpresaSchema.safeParse({ ruc: "FR48305461063", razonSocial: "RBL REI SAS" });
    expect(r.success).toBe(true);
  });

  it("acepta el tipo explicito no domiciliado con documento numerico corto", () => {
    const r = crearEmpresaSchema.safeParse({
      ruc: "903200006",
      tipoDocumento: TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO,
      razonSocial: "Compania Electro Metalurgica S.A.",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza un RUC invalido cuando el tipo es RUC", () => {
    const r = crearEmpresaSchema.safeParse({
      ruc: "2060123456",
      tipoDocumento: TIPOS_DOCUMENTO_EMPRESA.RUC,
      razonSocial: "Minera Demo S.A.C.",
    });
    expect(r.success).toBe(false);
  });

  it("rechaza un documento vacio", () => {
    const r = crearEmpresaSchema.safeParse({ ruc: "", razonSocial: "Minera Demo S.A.C." });
    expect(r.success).toBe(false);
  });
});

describe("actualizarEmpresaSchema (parcial)", () => {
  it("permite editar solo la razon social sin documento", () => {
    const r = actualizarEmpresaSchema.safeParse({ id: "emp-1", razonSocial: "Nueva Razon S.A." });
    expect(r.success).toBe(true);
  });

  it("valida el documento cuando llega en la edicion", () => {
    expect(actualizarEmpresaSchema.safeParse({ id: "emp-1", ruc: "FR48305461063" }).success).toBe(true);
    expect(actualizarEmpresaSchema.safeParse({ id: "emp-1", ruc: "" }).success).toBe(false);
  });
});

describe("validarDatosEmpresaSchema", () => {
  it("sigue exigiendo los datos del representante", () => {
    const r = validarDatosEmpresaSchema.safeParse({
      ruc: "20601234567",
      razonSocial: "Minera Demo S.A.C.",
      representanteLegalNombre: "Juan Perez",
      representanteLegalDni: "45871233",
      representanteCorreo: "juan@minera.pe",
      representanteCelular: "999888777",
      representanteDireccion: "Av. Los Ingenieros 245",
    });
    expect(r.success).toBe(true);
  });
});
