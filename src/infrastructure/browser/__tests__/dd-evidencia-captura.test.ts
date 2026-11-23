import { describe, expect, it } from "vitest";
import { esPaginaBloqueada, separarNombreInterpol } from "../dd-evidencia-captura";

describe("separarNombreInterpol", () => {
  it("toma las dos ultimas palabras como apellidos", () => {
    expect(separarNombreInterpol("CARLOS EDUARDO SILVA ROCHA")).toEqual({ apellido: "SILVA ROCHA", nombre: "CARLOS EDUARDO" });
    expect(separarNombreInterpol("JUAN PEREZ LOPEZ")).toEqual({ apellido: "PEREZ LOPEZ", nombre: "JUAN" });
  });
  it("con dos palabras la ultima es el apellido", () => {
    expect(separarNombreInterpol("JOHN SMITH")).toEqual({ apellido: "SMITH", nombre: "JOHN" });
  });
  it("con una palabra no hay nombre", () => {
    expect(separarNombreInterpol("  SMITH ")).toEqual({ apellido: "SMITH", nombre: "" });
  });
});

describe("esPaginaBloqueada", () => {
  it("detecta el bloqueo del firewall de Indecopi", () => {
    expect(esPaginaBloqueada("block Web Page Blocked! The page cannot be displayed. Please contact the administrator")).toBe(true);
  });
  it("detecta la pantalla de inicio de Indecopi con el error de carga", () => {
    expect(esPaginaBloqueada("Hola, Conoce más sobre tu proveedor Error Cargando las opciones de búsqueda.")).toBe(true);
    expect(esPaginaBloqueada("Error Cargando   las opciones de busqueda")).toBe(true);
  });
  it("detecta otros bloqueos comunes", () => {
    expect(esPaginaBloqueada("Access Denied You don't have permission")).toBe(true);
    expect(esPaginaBloqueada("Attention Required! | Cloudflare")).toBe(true);
  });
  it("una pagina de resultados normal no se considera bloqueada", () => {
    expect(esPaginaBloqueada("Búsqueda simple Nombre comercial/Razón social/RUC Buscar Limpiar Nº Razón social 0 de 0")).toBe(false);
    expect(esPaginaBloqueada("")).toBe(false);
  });
});
