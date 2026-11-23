import { describe, expect, it } from "vitest";
import { esVinculoEmpresa, etiquetaTipoVinculo } from "../dd-matriz-vinculo-vista";

describe("esVinculoEmpresa", () => {
  it("la fila de la empresa y la vinculada con RUC son empresas", () => {
    expect(esVinculoEmpresa({ tipo: "empresa" })).toBe(true);
    expect(esVinculoEmpresa({ tipo: "vinculado", tipoDocumento: "RUC" })).toBe(true);
  });
  it("las personas (DNI, carnet, pasaporte) y los vinculados sin documento no lo son", () => {
    expect(esVinculoEmpresa({ tipo: "vinculado", tipoDocumento: "DNI" })).toBe(false);
    expect(esVinculoEmpresa({ tipo: "vinculado", tipoDocumento: "Pasaporte" })).toBe(false);
    expect(esVinculoEmpresa({ tipo: "vinculado", tipoDocumento: null })).toBe(false);
    expect(esVinculoEmpresa({ tipo: "beneficiario", tipoDocumento: "RUC" })).toBe(false);
    expect(esVinculoEmpresa({ tipo: "representante", tipoDocumento: "DNI" })).toBe(false);
  });
});

describe("etiquetaTipoVinculo", () => {
  it("un vinculado con RUC se llama Empresa vinculada", () => {
    expect(etiquetaTipoVinculo({ tipo: "vinculado", tipoDocumento: "RUC" })).toBe("Empresa vinculada");
  });
  it("un vinculado con DNI, carnet o pasaporte se llama Persona vinculada", () => {
    expect(etiquetaTipoVinculo({ tipo: "vinculado", tipoDocumento: "DNI" })).toBe("Persona vinculada");
    expect(etiquetaTipoVinculo({ tipo: "vinculado", tipoDocumento: "Carnet de extranjería" })).toBe("Persona vinculada");
  });
  it("sin documento conserva la etiqueta generica", () => {
    expect(etiquetaTipoVinculo({ tipo: "vinculado", tipoDocumento: null })).toBe("Persona / empresa vinculada");
    expect(etiquetaTipoVinculo({ tipo: "vinculado" })).toBe("Persona / empresa vinculada");
  });
  it("los demas tipos no cambian", () => {
    expect(etiquetaTipoVinculo({ tipo: "empresa" })).toBe("Empresa");
    expect(etiquetaTipoVinculo({ tipo: "representante", tipoDocumento: "DNI" })).toBe("Representante legal");
    expect(etiquetaTipoVinculo({ tipo: "beneficiario", tipoDocumento: "RUC" })).toBe("Beneficiario final");
    expect(etiquetaTipoVinculo({ tipo: "raro" })).toBe("raro");
  });
});
