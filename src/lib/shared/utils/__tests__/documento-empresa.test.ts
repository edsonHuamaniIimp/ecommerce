import { describe, expect, it } from "vitest";
import { TIPOS_DOCUMENTO_EMPRESA } from "@/lib/shared/constants";
import {
  etiquetaTipoDocumentoEmpresa,
  normalizarDocumentoEmpresa,
  resolverTipoDocumentoEmpresa,
  validarDocumentoEmpresa,
} from "../documento-empresa";

describe("normalizarDocumentoEmpresa", () => {
  it("quita separadores y pasa a mayusculas", () => {
    expect(normalizarDocumentoEmpresa(" 20.601.234-567 ")).toBe("20601234567");
    expect(normalizarDocumentoEmpresa("fr48305461063")).toBe("FR48305461063");
  });
});

describe("resolverTipoDocumentoEmpresa", () => {
  it("autodetecta RUC por 11 digitos y RUT por el resto", () => {
    expect(resolverTipoDocumentoEmpresa("", "20601234567")).toBe(TIPOS_DOCUMENTO_EMPRESA.RUC);
    expect(resolverTipoDocumentoEmpresa("", "FR48305461063")).toBe(TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO);
    expect(resolverTipoDocumentoEmpresa("", "903200006")).toBe(TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO);
  });

  it("acepta el tipo explicito con alias", () => {
    expect(resolverTipoDocumentoEmpresa("RUC", "FR48305461063")).toBe(TIPOS_DOCUMENTO_EMPRESA.RUC);
    expect(resolverTipoDocumentoEmpresa("RUT", "20601234567")).toBe(TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO);
    expect(resolverTipoDocumentoEmpresa("no domiciliado", "x")).toBe(TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO);
    expect(resolverTipoDocumentoEmpresa("6", "20601234567")).toBe(TIPOS_DOCUMENTO_EMPRESA.RUC);
    expect(resolverTipoDocumentoEmpresa("0", "X")).toBe(TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO);
  });

  it("devuelve null con un tipo explicito desconocido", () => {
    expect(resolverTipoDocumentoEmpresa("PAS", "123")).toBeNull();
  });
});

describe("validarDocumentoEmpresa", () => {
  it("valida RUC de 11 digitos", () => {
    expect(validarDocumentoEmpresa(TIPOS_DOCUMENTO_EMPRESA.RUC, "20601234567")).toBeNull();
    expect(validarDocumentoEmpresa(TIPOS_DOCUMENTO_EMPRESA.RUC, "20-60")).toContain("RUC invalido");
  });

  it("valida RUT alfanumerico hasta 20", () => {
    expect(validarDocumentoEmpresa(TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO, "FR48305461063")).toBeNull();
    expect(validarDocumentoEmpresa(TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO, "903200006")).toBeNull();
    expect(validarDocumentoEmpresa(TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO, "X".repeat(21))).toContain("RUT/Documento invalido");
    expect(validarDocumentoEmpresa(TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO, "")).toBe("Documento obligatorio");
  });
});

describe("etiquetaTipoDocumentoEmpresa", () => {
  it("RUC para el codigo 6 y RUT para el resto", () => {
    expect(etiquetaTipoDocumentoEmpresa(TIPOS_DOCUMENTO_EMPRESA.RUC)).toBe("RUC");
    expect(etiquetaTipoDocumentoEmpresa(TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO)).toBe("RUT");
  });
});
