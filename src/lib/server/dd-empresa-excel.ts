import "server-only";

import ExcelJS from "exceljs";
import {
  DD_RESULTADOS,
  DD_TIPOS_DOCUMENTO_EMPRESA,
  type DdResultado,
  type DdTipoDocumentoEmpresa,
} from "@/lib/shared/constants";

export interface DdEmpresaImportRow {
  fila: number;
  documento: string;
  razonSocial: string;
  tipoDocumento: DdTipoDocumentoEmpresa;
  motivoEvaluacion: string | null;
  eventoProyecto: string | null;
  resultado: DdResultado;
  estadoOrigen: string;
  fechaIngreso: Date | null;
  fechaRevision: Date | null;
  fechaVencimiento: Date | null;
}

export interface DdEmpresaImportError {
  fila: number;
  documento: string;
  mensaje: string;
}

export interface DdEmpresaImportParseResult {
  rows: DdEmpresaImportRow[];
  errors: DdEmpresaImportError[];
  omitidos: number;
}

const HEADERS = {
  ingreso: "FECHA DE INGRESO SOLICITUD",
  revision: "FECHA DE REVISION POR SIG",
  persona: "PERSONA JURIDICA / PERSONA NATURAL",
  documento: "RUC / DNI / ID",
  motivo: "MOTIVO DE LA EVALUACION",
  evento: "EVENTO O PROYECTO ASOCIADO",
  resultado: "RESULTADO DE EVALUACION DEBIDA DILIGENCIA",
} as const;

type HeaderKey = keyof typeof HEADERS;

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "object") {
    const rich = valor as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (typeof rich.text === "string") return rich.text.trim();
    if (rich.result !== undefined) return texto(rich.result);
    if (Array.isArray(rich.richText)) {
      return rich.richText.map((parte) => parte.text).join("").trim();
    }
  }
  return String(valor).trim();
}

function fecha(valor: unknown): Date | null {
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

function documentoNormalizado(valor: unknown): string {
  return texto(valor)
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/\s+/g, "")
    .replace(/\.+$/g, "")
    .trim()
    .toUpperCase();
}

/**
 * Correcciones puntuales de identificadores truncados por la fuente original.
 * TEGA Chile venia como `2.03E+11` (notacion cientifica de Excel); su RUT real
 * fue confirmado por negocio como 202608324489.
 */
const DOCUMENTOS_POR_RAZON_SOCIAL = new Map<string, string>([
  ["TEGA INDUSTRIES CHILE SPA", "202608324489"],
]);

function documentoConAlias(documento: string, razonSocial: string): string {
  const alias = DOCUMENTOS_POR_RAZON_SOCIAL.get(normalizar(razonSocial));
  return alias ?? documento;
}

function clasificarDocumento(documento: string): DdTipoDocumentoEmpresa | null {
  if (/^\d{11}$/.test(documento)) return DD_TIPOS_DOCUMENTO_EMPRESA.RUC;
  if (/^\d{8}$/.test(documento)) return null;
  if (/^[A-Z0-9][A-Z0-9.-]{2,19}$/.test(documento)) {
    return DD_TIPOS_DOCUMENTO_EMPRESA.RUT;
  }
  return null;
}

function resultado(valor: string): DdResultado | null {
  const normalizado = normalizar(valor);
  if (normalizado.includes("APTO CON OBSERVACIONES")) {
    return DD_RESULTADOS.APTO_CON_OBSERVACIONES;
  }
  if (normalizado === "APTO") return DD_RESULTADOS.APTO;
  if (normalizado.includes("NO APTO")) return DD_RESULTADOS.NO_APTO;
  if (
    normalizado.includes("REVIS") ||
    normalizado.includes("PROCESO") ||
    normalizado.includes("OBSERV")
  ) {
    return DD_RESULTADOS.PENDIENTE;
  }
  return null;
}

function parseDelimited(textoPlano: string, delimitador: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;

  for (let i = 0; i < textoPlano.length; i += 1) {
    const caracter = textoPlano[i];
    if (caracter === '"') {
      if (entreComillas && textoPlano[i + 1] === '"') {
        celda += '"';
        i += 1;
      } else {
        entreComillas = !entreComillas;
      }
      continue;
    }
    if (!entreComillas && caracter === delimitador) {
      fila.push(celda);
      celda = "";
      continue;
    }
    if (!entreComillas && (caracter === "\n" || caracter === "\r")) {
      if (caracter === "\r" && textoPlano[i + 1] === "\n") i += 1;
      fila.push(celda);
      if (fila.some((valor) => valor.trim())) filas.push(fila);
      fila = [];
      celda = "";
      continue;
    }
    celda += caracter;
  }
  fila.push(celda);
  if (fila.some((valor) => valor.trim())) filas.push(fila);
  return filas;
}

function matrizCsv(buffer: Buffer): string[][] {
  const contenido = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
  const primeraLinea = contenido.split(/\r?\n/, 1)[0] ?? "";
  const delimitador = primeraLinea.includes("\t")
    ? "\t"
    : primeraLinea.includes(";")
      ? ";"
      : ",";
  return parseDelimited(contenido, delimitador);
}

async function matrizXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const hoja = workbook.worksheets[0];
  if (!hoja) throw new Error("El archivo no contiene hojas.");
  const filas: string[][] = [];
  hoja.eachRow({ includeEmpty: false }, (row) => {
    const valores: string[] = [];
    for (let columna = 1; columna <= hoja.columnCount; columna += 1) {
      valores.push(texto(row.getCell(columna).value));
    }
    filas.push(valores);
  });
  return filas;
}

function indicesCabecera(filas: string[][]): Record<HeaderKey, number> {
  const primera = filas[0] ?? [];
  const indices = {} as Record<HeaderKey, number>;
  for (const clave of Object.keys(HEADERS) as HeaderKey[]) {
    const indice = primera.findIndex((valor) => normalizar(valor) === normalizar(HEADERS[clave]));
    if (indice < 0) throw new Error(`Falta la columna "${HEADERS[clave]}".`);
    indices[clave] = indice;
  }
  return indices;
}

export async function parseEmpresasExcel(
  buffer: Buffer,
  nombreArchivo: string,
): Promise<DdEmpresaImportParseResult> {
  const extension = nombreArchivo.split(".").pop()?.toLowerCase() ?? "";
  if (extension !== "xlsx" && extension !== "csv" && extension !== "txt") {
    throw new Error("Formato no permitido. Use un archivo XLSX, CSV o TXT.");
  }
  const filas = extension === "xlsx" ? await matrizXlsx(buffer) : matrizCsv(buffer);
  if (filas.length < 2) throw new Error("El archivo no contiene filas de datos.");

  const indices = indicesCabecera(filas);
  const rows: DdEmpresaImportRow[] = [];
  const errors: DdEmpresaImportError[] = [];
  let omitidos = 0;

  for (let numero = 1; numero < filas.length; numero += 1) {
    const fila = filas[numero] ?? [];
    const documentoFuente = documentoNormalizado(fila[indices.documento]);
    const razonSocial = texto(fila[indices.persona]);
    const documento = documentoFuente ? documentoConAlias(documentoFuente, razonSocial) : "";
    const estadoOrigen = texto(fila[indices.resultado]);

    if (!documento && !razonSocial && !estadoOrigen) {
      omitidos += 1;
      continue;
    }
    if (!documento || !razonSocial || !estadoOrigen) {
      errors.push({ fila: numero + 1, documento, mensaje: "Documento, razón social y resultado son obligatorios." });
      continue;
    }

    const tipoDocumento = clasificarDocumento(documento);
    if (!tipoDocumento) {
      errors.push({
        fila: numero + 1,
        documento,
        mensaje: "Identificador inválido: solo se aceptan RUC (11 dígitos) o RUT/identificador extranjero.",
      });
      continue;
    }

    const resultadoNormalizado = resultado(estadoOrigen);
    if (!resultadoNormalizado) {
      errors.push({ fila: numero + 1, documento, mensaje: `Resultado no reconocido: ${estadoOrigen}.` });
      continue;
    }

    const fechaIngreso = fecha(fila[indices.ingreso]);
    const fechaRevision = fecha(fila[indices.revision]);
    const fechaVencimiento =
      resultadoNormalizado === DD_RESULTADOS.APTO ||
      resultadoNormalizado === DD_RESULTADOS.APTO_CON_OBSERVACIONES
        ? sumarMeses(fechaRevision ?? fechaIngreso ?? new Date(), 6)
        : null;

    rows.push({
      fila: numero + 1,
      documento,
      razonSocial,
      tipoDocumento,
      motivoEvaluacion: texto(fila[indices.motivo]) || null,
      eventoProyecto: texto(fila[indices.evento]) || null,
      resultado: resultadoNormalizado,
      estadoOrigen,
      fechaIngreso,
      fechaRevision,
      fechaVencimiento,
    });
  }

  return { rows, errors, omitidos };
}
