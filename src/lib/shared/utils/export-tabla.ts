import { archivoUtils } from "./archivo";

/** Columna de una exportacion tabular (CSV/Excel). */
export interface ColumnaExportacion<T> {
  encabezado: string;
  valor: (fila: T) => string | number | null | undefined;
}

/** Escapa una celda para CSV (comillas, comas y saltos de linea). */
export function csvCelda(valor: string | number | null | undefined): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

/** Nombre de archivo con marca de fecha/hora (YYYYMMDD-HHmm). */
export function nombreArchivoExport(prefijo: string, extension: "csv" | "xlsx"): string {
  const ahora = new Date();
  const dos = (n: number) => String(n).padStart(2, "0");
  const marca = `${ahora.getFullYear()}${dos(ahora.getMonth() + 1)}${dos(ahora.getDate())}-${dos(ahora.getHours())}${dos(ahora.getMinutes())}`;
  return `${prefijo}-${marca}.${extension}`;
}

function filasMatriz<T>(filas: T[], columnas: ColumnaExportacion<T>[]): Array<Array<string | number>> {
  return filas.map((fila) => columnas.map((columna) => {
    const valor = columna.valor(fila);
    return valor === null || valor === undefined ? "" : valor;
  }));
}

/** Descarga las filas como CSV UTF-8 (con BOM para Excel). */
export function exportarTablaCsv<T>(filas: T[], columnas: ColumnaExportacion<T>[], nombre: string): void {
  const contenido = [columnas.map((c) => csvCelda(c.encabezado)).join(",")]
    .concat(filasMatriz(filas, columnas).map((fila) => fila.map(csvCelda).join(",")))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${contenido}`], { type: "text/csv;charset=utf-8" });
  archivoUtils.descargarBlob(blob, nombre);
}

/** Descarga las filas como Excel (.xlsx) usando exceljs (carga diferida). */
export async function exportarTablaExcel<T>(
  filas: T[],
  columnas: ColumnaExportacion<T>[],
  nombre: string,
  hoja = "Datos",
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(hoja);
  ws.columns = columnas.map((columna) => ({
    header: columna.encabezado,
    key: columna.encabezado,
    width: Math.max(14, columna.encabezado.length + 4),
  }));
  ws.addRows(filasMatriz(filas, columnas));
  ws.getRow(1).font = { bold: true };
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  archivoUtils.descargarBlob(blob, nombre);
}
