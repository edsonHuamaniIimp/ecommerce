import 'server-only';

import ExcelJS from "exceljs";
import { CAMPOS_CARGA_EMPRESA, CARGA_MASIVA_EXTENSIONES } from "@/lib/shared/constants";
import type { CampoPlantillaEmpresa } from "@/lib/shared/constants";

/** Fila cruda leida del archivo de carga masiva (antes de validar). */
export interface FilaTablaEmpresa {
  /** Numero de fila del archivo (1 = encabezado; datos desde 2). */
  numero: number;
  valores: Partial<Record<CampoPlantillaEmpresa, string>>;
}

/** Error de parseo de archivo (extension, tamaño o formato). */
export class ParserTablaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParserTablaError";
  }
}

/** Normaliza encabezados: mayusculas, sin acentos ni separadores. */
function normalizarHeader(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Mapa header normalizado (y alias) -> campo. */
const HEADER_A_CAMPO = new Map<string, CampoPlantillaEmpresa>();
for (const columna of CAMPOS_CARGA_EMPRESA) {
  HEADER_A_CAMPO.set(normalizarHeader(columna.header), columna.campo);
  for (const alias of columna.alias ?? []) {
    HEADER_A_CAMPO.set(normalizarHeader(alias), columna.campo);
  }
}

/** Convierte la matriz de celdas en filas tipadas (sin filas vacias). */
function filasDesdeMatriz(matriz: string[][]): FilaTablaEmpresa[] {
  const [encabezado, ...cuerpo] = matriz;
  if (!encabezado || encabezado.length === 0) {
    throw new ParserTablaError("El archivo no tiene encabezados");
  }

  const columnas = encabezado.map((h) => HEADER_A_CAMPO.get(normalizarHeader(h ?? "")) ?? null);
  if (!columnas.some(Boolean)) {
    throw new ParserTablaError(
      `No se reconocio ninguna columna. Encabezados esperados: ${CAMPOS_CARGA_EMPRESA.map((c) => c.header).join(", ")}`,
    );
  }

  const filas: FilaTablaEmpresa[] = [];
  cuerpo.forEach((celdas, idx) => {
    const valores: Partial<Record<CampoPlantillaEmpresa, string>> = {};
    let tieneDatos = false;
    columnas.forEach((campo, col) => {
      if (!campo) return;
      const valor = String(celdas[col] ?? "").trim();
      if (valor) {
        valores[campo] = valor;
        tieneDatos = true;
      }
    });
    if (tieneDatos) filas.push({ numero: idx + 2, valores });
  });
  return filas;
}

/** Parsea CSV (delimitador `,` o `;`) con soporte basico de comillas. */
function parsearCsv(texto: string): string[][] {
  const limpio = texto.replace(/^\uFEFF/, "");
  const primeraLinea = limpio.split(/\r?\n/, 1)[0] ?? "";
  const delimitador = (primeraLinea.match(/;/g)?.length ?? 0) > (primeraLinea.match(/,/g)?.length ?? 0) ? ";" : ",";

  const filas: string[][] = [];
  let celda = "";
  let fila: string[] = [];
  let entreComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const char = limpio[i];
    if (entreComillas) {
      if (char === '"' && limpio[i + 1] === '"') { celda += '"'; i++; }
      else if (char === '"') entreComillas = false;
      else celda += char;
    } else if (char === '"') {
      entreComillas = true;
    } else if (char === delimitador) {
      fila.push(celda); celda = "";
    } else if (char === "\n") {
      fila.push(celda); celda = ""; filas.push(fila); fila = [];
    } else if (char !== "\r") {
      celda += char;
    }
  }
  if (celda.length > 0 || fila.length > 0) { fila.push(celda); filas.push(fila); }
  return filas;
}

/**
 * Parsea un archivo Excel (.xlsx) o CSV con las columnas de `CAMPOS_CARGA_EMPRESA`.
 * Devuelve filas tipadas (sin encabezado ni filas vacias).
 */
export async function parsearArchivoEmpresas(nombreArchivo: string, contenido: ArrayBuffer): Promise<FilaTablaEmpresa[]> {
  const extension = (nombreArchivo.split(".").pop() ?? "").toLowerCase();
  if (!(CARGA_MASIVA_EXTENSIONES as readonly string[]).includes(extension)) {
    throw new ParserTablaError(`Formato no permitido (.${extension || "?"}). Admitidos: ${CARGA_MASIVA_EXTENSIONES.join(", ")}.`);
  }

  if (extension === "csv") {
    const texto = new TextDecoder("utf-8").decode(contenido);
    return filasDesdeMatriz(parsearCsv(texto));
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(contenido);
  } catch {
    throw new ParserTablaError("No se pudo leer el archivo Excel. Verifica que sea un .xlsx valido.");
  }
  const hoja = workbook.worksheets[0];
  if (!hoja) throw new ParserTablaError("El archivo Excel no tiene hojas");

  const matriz: string[][] = [];
  hoja.eachRow({ includeEmpty: false }, (row) => {
    const celdas: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const valor = cell.value;
      celdas.push(
        valor === null || valor === undefined
          ? ""
          : typeof valor === "object" && "text" in valor
            ? String((valor as { text: string }).text)
            : typeof valor === "object" && "result" in valor
              ? String((valor as { result: unknown }).result ?? "")
              : String(valor),
      );
    });
    matriz.push(celdas);
  });
  return filasDesdeMatriz(matriz);
}
