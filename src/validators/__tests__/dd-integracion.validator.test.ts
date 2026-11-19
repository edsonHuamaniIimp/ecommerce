import { describe, expect, it } from "vitest";
import { ddIntegracionDocumentosQuerySchema } from "@/validators/dd-integracion.validator";

describe("ddIntegracionDocumentosQuerySchema", () => {
  it("acepta RUC con tipo de documento", () => {
    const resultado = ddIntegracionDocumentosQuerySchema.safeParse({
      tipoDocumento: "ruc",
      documento: "20609385023",
    });

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.tipoDocumento).toBe("RUC");
      expect(resultado.data.page).toBe(1);
      expect(resultado.data.perPage).toBe(20);
    }
  });

  it("acepta RUT alfanumérico", () => {
    const resultado = ddIntegracionDocumentosQuerySchema.safeParse({
      tipoDocumento: "RUT",
      documento: "FR48305461063",
    });

    expect(resultado.success).toBe(true);
  });

  it("exige tipo de documento cuando se busca por documento", () => {
    const resultado = ddIntegracionDocumentosQuerySchema.safeParse({
      documento: "20609385023",
    });

    expect(resultado.success).toBe(false);
  });

  it("exige un filtro de búsqueda", () => {
    const resultado = ddIntegracionDocumentosQuerySchema.safeParse({});

    expect(resultado.success).toBe(false);
  });

  it("rechaza un RUC que no tiene 11 dígitos", () => {
    const resultado = ddIntegracionDocumentosQuerySchema.safeParse({
      tipoDocumento: "RUC",
      documento: "2060938502",
    });

    expect(resultado.success).toBe(false);
  });

  it("permite buscar solo por razón social", () => {
    const resultado = ddIntegracionDocumentosQuerySchema.safeParse({
      razonSocial: "CORPORACION AIREX",
    });

    expect(resultado.success).toBe(true);
  });

  it("limita el tamaño de página", () => {
    const resultado = ddIntegracionDocumentosQuerySchema.safeParse({
      razonSocial: "AIREX",
      perPage: "100",
    });

    expect(resultado.success).toBe(false);
  });
});
