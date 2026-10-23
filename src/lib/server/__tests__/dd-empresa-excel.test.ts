import { describe, expect, it } from "vitest";
import { parseEmpresasExcel } from "../dd-empresa-excel";
import { DD_RESULTADOS } from "@/lib/shared/constants";

const ARCHIVO = [
  'FECHA DE INGRESO SOLICITUD;FECHA DE REVISIÓN POR SIG;PERSONA JURIDICA / PERSONA NATURAL;RUC / DNI / ID;MOTIVO DE LA EVALUACIÓN;EVENTO O PROYECTO ASOCIADO;"RESULTADO DE EVALUACIÓN',
  'DEBIDA DILIGENCIA"',
  "1/10/2026;2/10/2026;EMPRESA APTA S.A.C.;20549974342;EXHIBIDOR;PERUMIN;APTO",
  "2/10/2026;5/10/2026;EMPRESA PENDIENTE S.A.C.;20602295398;EXHIBIDOR;PERUMIN;EN REVISIÓN",
  "2/10/2026;5/10/2026;XCEL INSPECTION SOLUTIONS LT D;SIC. 71122;EXHIBIDOR;PERUMIN;APTO",
  "6/10/2026;7/10/2026;TEGA INDUSTRIES CHILE SPA;2.03E+11;EXHIBIDOR;IIMP;APTO",
  "6/10/2026;7/10/2026;MARLEW S.A.;33-58551048-9;EXHIBIDOR;IIMP;APTO",
  "6/10/2026;7/10/2026;PERSONA NATURAL;12345678;EXHIBIDOR;IIMP;APTO",
].join("\n");

describe("parseEmpresasExcel", () => {
  it.each(["resultado.txt", "resultado.csv"])(
    "lee %s separado por punto y coma y cabecera con salto de línea",
    async (nombre) => {
      const resultado = await parseEmpresasExcel(Buffer.from(ARCHIVO, "utf8"), nombre);

      expect(resultado.errors).toEqual([]);
      expect(resultado.rows).toHaveLength(6);
      expect(resultado.rows[0]).toMatchObject({
        documento: "20549974342",
        resultado: DD_RESULTADOS.APTO,
        fechaRevision: new Date(2026, 9, 2),
        fechaVencimiento: new Date(2027, 3, 2),
      });
      expect(resultado.rows[1]).toMatchObject({
        documento: "20602295398",
        resultado: DD_RESULTADOS.PENDIENTE,
      });
      expect(resultado.rows[2]).toMatchObject({
        documento: "SIC.71122",
        tipoDocumento: "EXTRANJERO",
      });
      expect(resultado.rows[3]).toMatchObject({
        documento: "202608324489",
        tipoDocumento: "RUT",
      });
      expect(resultado.rows[4]).toMatchObject({
        documento: "33-58551048-9",
        tipoDocumento: "RUT",
      });
      expect(resultado.rows[5]).toMatchObject({
        documento: "12345678",
        tipoDocumento: "DNI",
      });
    },
  );

  it("no inventa fecha de cese cuando falta la aprobacion en la fuente", async () => {
    const sinRevision = [
      'FECHA DE INGRESO SOLICITUD;FECHA DE REVISION POR SIG;PERSONA JURIDICA / PERSONA NATURAL;RUC / DNI / ID;MOTIVO DE LA EVALUACION;EVENTO O PROYECTO ASOCIADO;RESULTADO DE EVALUACION DEBIDA DILIGENCIA',
      "1/10/2026;;EMPRESA SIN FECHA S.A.C.;20549974342;EXHIBIDOR;PERUMIN;APTO",
    ].join("\n");

    const resultado = await parseEmpresasExcel(Buffer.from(sinRevision, "utf8"), "resultado.csv");

    expect(resultado.errors).toEqual([]);
    expect(resultado.rows[0]).toMatchObject({
      resultado: DD_RESULTADOS.APTO,
      fechaRevision: null,
      fechaVencimiento: null,
    });
  });
});
