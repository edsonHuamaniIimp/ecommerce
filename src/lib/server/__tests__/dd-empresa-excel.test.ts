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
].join("\n");

describe("parseEmpresasExcel", () => {
  it.each(["resultado.txt", "resultado.csv"])(
    "lee %s separado por punto y coma y cabecera con salto de línea",
    async (nombre) => {
      const resultado = await parseEmpresasExcel(Buffer.from(ARCHIVO, "utf8"), nombre);

      expect(resultado.errors).toEqual([]);
      expect(resultado.rows).toHaveLength(4);
      expect(resultado.rows[0]).toMatchObject({
        documento: "20549974342",
        resultado: DD_RESULTADOS.APTO,
      });
      expect(resultado.rows[1]).toMatchObject({
        documento: "20602295398",
        resultado: DD_RESULTADOS.PENDIENTE,
      });
      expect(resultado.rows[2]?.documento).toBe("SIC.71122");
      expect(resultado.rows[3]?.documento).toBe("202608324489");
    },
  );
});
