import "dotenv/config";

import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * Importa la lista oficial de Debida Diligencia desde un Excel.
 *
 * Uso:
 *   npx tsx scripts/import-dd-excel.ts "C:\ruta\RESULTADO DEBIDA DILIGENCIA.xlsx"
 *
 * El proceso es idempotente por documento (RUC/DNI/ID): actualiza el estado
 * existente y no elimina empresas que ya no aparezcan en el archivo.
 */

const filePath = process.argv[2]?.trim();
if (!filePath) {
  throw new Error('Indica la ruta del Excel: npx tsx scripts/import-dd-excel.ts "C:\\ruta\\archivo.xlsx"');
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no definida");
const pool = new Pool({ connectionString, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const HEADER = {
  ingreso: "FECHA DE INGRESO SOLICITUD",
  revision: "FECHA DE REVISION POR SIG",
  persona: "PERSONA JURIDICA / PERSONA NATURAL",
  documento: "RUC / DNI / ID",
  motivo: "MOTIVO DE LA EVALUACION",
  evento: "EVENTO O PROYECTO ASOCIADO",
  resultado: "RESULTADO DE EVALUACION DEBIDA DILIGENCIA",
} as const;

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function texto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "object") {
    if ("text" in valor && typeof valor.text === "string") return valor.text.trim();
    if ("result" in valor) return texto(valor.result as ExcelJS.CellValue);
    if ("richText" in valor && Array.isArray(valor.richText)) {
      return valor.richText.map((parte) => parte.text).join("").trim();
    }
  }
  return String(valor).trim();
}

function fecha(valor: ExcelJS.CellValue): Date | null {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor === "number" && Number.isFinite(valor)) {
    const fechaExcel = new Date(Date.UTC(1899, 11, 30) + valor * 86400000);
    return Number.isNaN(fechaExcel.getTime()) ? null : fechaExcel;
  }
  const raw = texto(valor);
  if (!raw) return null;

  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (dmy) {
    const [, dia = "1", mes = "1", anio = "1970"] = dmy;
    return new Date(Number(anio), Number(mes) - 1, Number(dia));
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) {
    const [, anio = "1970", mes = "1", dia = "1"] = iso;
    return new Date(Number(anio), Number(mes) - 1, Number(dia));
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sumarMeses(fechaBase: Date, meses: number): Date {
  const resultado = new Date(fechaBase.getTime());
  const dia = resultado.getDate();
  resultado.setDate(1);
  resultado.setMonth(resultado.getMonth() + meses);
  const ultimoDia = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate();
  resultado.setDate(Math.min(dia, ultimoDia));
  return resultado;
}

function limpiarDocumento(valor: ExcelJS.CellValue): string {
  return texto(valor)
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/\.+$/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function tipoDocumento(documento: string): string {
  if (/^\d{11}$/.test(documento)) return "RUC";
  if (/^\d{8}$/.test(documento)) return "DNI";
  if (/^[A-Z0-9.-]+$/i.test(documento) && /[A-Z]/i.test(documento)) return "EXTRANJERO";
  return "OTRO";
}

function resultadoNormalizado(valor: string): string {
  const normalizado = normalizar(valor);
  if (normalizado.includes("APTO CON OBSERVACIONES")) return "apto_con_observaciones";
  if (normalizado === "APTO") return "apto";
  if (normalizado.includes("NO APTO")) return "no_apto";
  if (
    normalizado.includes("REVIS") ||
    normalizado.includes("PROCESO") ||
    normalizado.includes("OBSERV")
  ) {
    return "pendiente";
  }
  return "pendiente";
}

function indiceColumnas(hoja: ExcelJS.Worksheet): Record<keyof typeof HEADER, number> {
  const indices: Partial<Record<keyof typeof HEADER, number>> = {};
  hoja.getRow(1).eachCell((cell, colNumber) => {
    const header = normalizar(texto(cell.value));
    for (const clave of Object.keys(HEADER) as Array<keyof typeof HEADER>) {
      if (header === normalizar(HEADER[clave])) indices[clave] = colNumber;
    }
  });
  for (const clave of Object.keys(HEADER) as Array<keyof typeof HEADER>) {
    if (!indices[clave]) {
      throw new Error(`No se encontro la columna "${HEADER[clave]}" en el Excel.`);
    }
  }
  return indices as Record<keyof typeof HEADER, number>;
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath as string);
  const hoja = workbook.worksheets[0];
  if (!hoja) throw new Error("El Excel no tiene hojas.");
  const columnas = indiceColumnas(hoja);

  let importados = 0;
  let omitidos = 0;
  const resultados: Record<string, number> = {};

  for (let fila = 2; fila <= hoja.actualRowCount; fila += 1) {
    const row = hoja.getRow(fila);
    const documento = limpiarDocumento(row.getCell(columnas.documento).value);
    const razonSocial = texto(row.getCell(columnas.persona).value);
    const resultadoOrigen = texto(row.getCell(columnas.resultado).value);
    if (!documento || !razonSocial || !resultadoOrigen) {
      omitidos += 1;
      continue;
    }

    const fechaIngreso = fecha(row.getCell(columnas.ingreso).value);
    const fechaRevision = fecha(row.getCell(columnas.revision).value);
    const resultado = resultadoNormalizado(resultadoOrigen);
    const fechaVencimiento =
      resultado === "apto" || resultado === "apto_con_observaciones"
        ? sumarMeses(fechaRevision ?? fechaIngreso ?? new Date(), 6)
        : null;
    const tipo = tipoDocumento(documento);

    await prisma.debidaDiligenciaEmpresaEstado.upsert({
      where: { documento },
      update: {
        razonSocial,
        tipoDocumento: tipo,
        motivoEvaluacion: texto(row.getCell(columnas.motivo).value) || null,
        eventoProyecto: texto(row.getCell(columnas.evento).value) || null,
        resultado,
        estadoOrigen: resultadoOrigen,
        fechaIngreso,
        fechaRevision,
        fechaVencimiento,
        origen: "excel_dd",
      },
      create: {
        documento,
        razonSocial,
        tipoDocumento: tipo,
        motivoEvaluacion: texto(row.getCell(columnas.motivo).value) || null,
        eventoProyecto: texto(row.getCell(columnas.evento).value) || null,
        resultado,
        estadoOrigen: resultadoOrigen,
        fechaIngreso,
        fechaRevision,
        fechaVencimiento,
        origen: "excel_dd",
      },
    });
    importados += 1;
    resultados[resultado] = (resultados[resultado] ?? 0) + 1;
  }

  console.log(JSON.stringify({ importados, omitidos, resultados }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
