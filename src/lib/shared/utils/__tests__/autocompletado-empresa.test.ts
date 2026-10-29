import { describe, expect, it } from "vitest";
import {
  camposAutocompletadosDni,
  camposAutocompletadosRuc,
  nombreCompletoDesdeDni,
} from "../autocompletado-empresa";

describe("camposAutocompletadosRuc", () => {
  it("incluye solo los campos que SUNAT devuelve", () => {
    const campos = camposAutocompletadosRuc({
      razonSocial: "COMERCIAL INDUSTRIAL DELTA S A CIDELSA",
      direccion: "AV. LOS FLAMENCOS",
      actividadEconomica: "ARQUITECTURA",
      estado: "ACTIVO",
      condicion: "HABIDO",
    });

    expect(campos).toEqual([
      "ruc",
      "razonSocial",
      "nombreComercial",
      "facturarANombre",
      "direccionFiscal",
      "actividadEconomica",
      "estadoContribuyente",
    ]);
    expect(campos).not.toContain("sitioWeb");
    expect(campos).not.toContain("telefono");
  });

  it("no resalta campos opcionales que no vinieron en la respuesta", () => {
    expect(camposAutocompletadosRuc({ razonSocial: "DEMO" })).toEqual([
      "ruc",
      "razonSocial",
      "nombreComercial",
      "facturarANombre",
    ]);
  });
});

describe("camposAutocompletadosDni", () => {
  it("EXTEMIN solo actualiza campos de EXTEMIN", () => {
    const campos = camposAutocompletadosDni("extemin", true);
    expect(campos).toEqual(["responsableExteminDni", "responsableExteminNombre"]);
    expect(campos.some((c) => c.includes("Pagos"))).toBe(false);
    expect(campos.some((c) => c.includes("representante"))).toBe(false);
  });

  it("pagos solo actualiza campos de pagos", () => {
    const campos = camposAutocompletadosDni("pagos", true);
    expect(campos).toEqual(["responsablePagosDni", "responsablePagosNombre"]);
    expect(campos.some((c) => c.includes("Extemin"))).toBe(false);
    expect(campos.some((c) => c.includes("representante"))).toBe(false);
  });

  it("representante no toca responsables", () => {
    const campos = camposAutocompletadosDni("representante", true);
    expect(campos).toEqual(["representanteLegalDni", "representanteLegalNombre"]);
    expect(campos.some((c) => c.includes("responsable"))).toBe(false);
  });

  it("si RENIEC no devuelve nombre, solo resalta el DNI", () => {
    expect(camposAutocompletadosDni("pagos", false)).toEqual(["responsablePagosDni"]);
  });
});

describe("nombreCompletoDesdeDni", () => {
  it("prefiere nombreCompleto y arma el nombre con las partes", () => {
    expect(nombreCompletoDesdeDni({ nombreCompleto: "EDSON JORDAN HUAMANI ÑAHUIN" }))
      .toBe("EDSON JORDAN HUAMANI ÑAHUIN");
    expect(nombreCompletoDesdeDni({
      nombres: "EDSON JORDAN",
      apellidoPaterno: "HUAMANI",
      apellidoMaterno: "ÑAHUIN",
    })).toBe("EDSON JORDAN HUAMANI ÑAHUIN");
  });

  it("devuelve vacio sin respuesta", () => {
    expect(nombreCompletoDesdeDni(null)).toBe("");
  });
});
