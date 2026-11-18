import { describe, expect, it } from "vitest";
import {
  DD_MATRIZ_ADJUNTO_CATEGORIAS,
  DD_MATRIZ_CRITERIO_PREFIJO,
  DD_MATRIZ_TIPOS_VINCULO,
} from "@/lib/shared/constants";
import {
  clasificarNombreArchivo,
  validarNomenclaturaArchivo,
} from "../dd-repositorio-import";

describe("validarNomenclaturaArchivo", () => {
  it("acepta prefijo numérico y RUC", () => {
    expect(validarNomenclaturaArchivo("01. ABB SA reporte 20100022142.pdf").cumple).toBe(true);
  });

  it("advierte cuando falta el prefijo o el identificador", () => {
    expect(validarNomenclaturaArchivo("reporte-ofac.pdf").cumple).toBe(false);
    expect(validarNomenclaturaArchivo("01. reporte-ofac.pdf").cumple).toBe(false);
  });
});

describe("clasificarNombreArchivo", () => {
  const vinculos = [
    { id: "empresa", nombre: "ABB SA", tipo: DD_MATRIZ_TIPOS_VINCULO.EMPRESA },
    { id: "representante", nombre: "Jorge Robles", tipo: DD_MATRIZ_TIPOS_VINCULO.REPRESENTANTE },
  ];

  it("prioriza la coincidencia con el nombre del vínculo", () => {
    const resultado = clasificarNombreArchivo("01. ABB SA reporte 20100022142.pdf", vinculos);
    expect(resultado.vinculoId).toBe("empresa");
  });

  it("usa palabras clave para el tipo de vínculo y la categoría", () => {
    const resultado = clasificarNombreArchivo("03. Representante OFAC 12345678.pdf", vinculos);
    expect(resultado.vinculoId).toBe("representante");
    expect(resultado.categoria).toBe(`${DD_MATRIZ_CRITERIO_PREFIJO}ofac`);
  });

  it("prioriza el criterio INDECOPI sobre la palabra reporte", () => {
    const resultado = clasificarNombreArchivo("03. ABB SA Consulta de reportes de INDECOPI 20100022142.pdf", vinculos);
    expect(resultado.categoria).toBe(`${DD_MATRIZ_CRITERIO_PREFIJO}indecopi`);
  });

  it("clasifica certificados societarios como sustento de Compliance", () => {
    const resultado = clasificarNombreArchivo("01. ABB SA Certificado de existencia 20100022142.pdf", vinculos);
    expect(resultado.categoria).toBe(DD_MATRIZ_ADJUNTO_CATEGORIAS.COMPLIANCE_SUSTENTO);
  });

  it("clasifica publicaciones periodísticas como sustento reputacional", () => {
    const resultado = clasificarNombreArchivo("04. Jorge Robles Publicacion en portal periodistico 12345678.pdf", vinculos);
    expect(resultado.categoria).toBe(DD_MATRIZ_ADJUNTO_CATEGORIAS.REPUTACIONAL_SUSTENTO);
  });

  it("asigna Sentinel de empresa al criterio de central de riesgo empresarial", () => {
    const resultado = clasificarNombreArchivo("01. ABB SA Reporte Sentinel 20100022142.pdf", vinculos);
    expect(resultado.categoria).toBe(`${DD_MATRIZ_CRITERIO_PREFIJO}central_riesgo_empresa`);
  });

  it("asigna Sentinel de representante al criterio de central de riesgo de persona", () => {
    const resultado = clasificarNombreArchivo("02. Representante Jorge Robles Reporte Sentinel 12345678.pdf", vinculos);
    expect(resultado.categoria).toBe(`${DD_MATRIZ_CRITERIO_PREFIJO}central_riesgo_persona`);
  });

  it("asigna Sentinel de beneficiario al criterio de central de riesgo de persona", () => {
    const resultado = clasificarNombreArchivo("03. Beneficiario Jorge Robles Reporte Sentinel 12345678.pdf", vinculos);
    expect(resultado.categoria).toBe(`${DD_MATRIZ_CRITERIO_PREFIJO}central_riesgo_persona`);
  });
});
