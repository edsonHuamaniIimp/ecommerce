import type { DdMatrizBloqueDTO, DdMatrizEvaluacionExportFilaDTO } from "@/types/dto/debida-diligencia";
import {
  DD_IMPORTACION_REVISOR,
  DD_IMPORTACION_REVISOR_LABEL,
  DD_MATRIZ_AMBITO_LABELS,
  DD_MATRIZ_COLORES,
  DD_MATRIZ_CONCLUSION_COMPLIANCE_LABELS,
  DD_MATRIZ_CONCLUSION_LABELS,
  DD_MATRIZ_LISTAS,
  DD_MATRIZ_RESULTADO_FINAL_LABELS,
  DD_MATRIZ_RESULTADO_LABELS,
  DD_MATRIZ_SI_NO_NA_LABELS,
  DD_MATRIZ_TIPOS_VINCULO,
  type DdMatrizAmbito,
  type DdMatrizColor,
  type DdMatrizTipoVinculo,
} from "@/lib/shared/constants";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import type { ColumnaExportacion } from "@/lib/shared/utils/export-tabla";
import { listasAplicables } from "@/lib/shared/utils/dd-matriz-evaluacion";
import { nombrePais } from "@/lib/shared/utils/pais";

/** Texto de una celda no aplicable al ambito del vinculo (igual que la matriz oficial). */
const NO_APLICA = DD_MATRIZ_SI_NO_NA_LABELS.na;

type Celda = string | number | Date | null;

export interface ColumnaMatrizExcel {
  /** Encabezado exacto de la matriz oficial. */
  encabezado: string;
  /** lila = comun, naranja = solo nacional, celeste = solo extranjero. */
  color: DdMatrizColor;
  /** Ancho sugerido en caracteres. */
  ancho: number;
  valor: (fila: DdMatrizEvaluacionExportFilaDTO) => Celda;
}

export interface GrupoMatrizExcel {
  titulo: string;
  /** Indices (base 0) de la primera y ultima columna del grupo. */
  desde: number;
  hasta: number;
}

const fechaDe = (iso: string | null | undefined): Date | null => (iso ? new Date(iso) : null);
const etiqueta = (catalogo: Record<string, string>, valor: string | null | undefined): string =>
  valor ? (catalogo[valor] ?? valor) : "";
const numeroDe = (codigo: string): number | null => {
  const numero = Number.parseInt(codigo.split("-").pop() ?? "", 10);
  return Number.isNaN(numero) ? null : numero;
};
const esPersona = (tipo: string): boolean => tipo !== DD_MATRIZ_TIPOS_VINCULO.EMPRESA;

/** Responsable de revision: el de SIG o, mientras no haya, el del expediente (importacion masiva con su etiqueta). */
function responsableRevision(fila: DdMatrizEvaluacionExportFilaDTO): string {
  const propio = fila.vinculo.sig.responsable;
  if (propio) return propio;
  return fila.revisadoPor === DD_IMPORTACION_REVISOR ? DD_IMPORTACION_REVISOR_LABEL : (fila.revisadoPor ?? "");
}

/** Celda de una lista restrictiva: N.A. si no aplica al ambito, vacia si aun no se evalua. */
function celdaLista(
  codigo: string,
  listas: Record<string, string>,
  tipo: DdMatrizTipoVinculo,
  ambito: DdMatrizAmbito,
): string {
  const aplica = listasAplicables(tipo, ambito).some((l) => l.codigo === codigo);
  if (!aplica) return NO_APLICA;
  return etiqueta(DD_MATRIZ_SI_NO_NA_LABELS, listas[codigo]);
}

const columnaGeneral = (
  encabezado: string,
  ancho: number,
  valor: ColumnaMatrizExcel["valor"],
): ColumnaMatrizExcel => ({ encabezado, color: DD_MATRIZ_COLORES.COMUN, ancho, valor });

/** Columnas de listas restrictivas: mismos encabezados y orden que la matriz oficial. */
function columnasLista(
  codigos: string[],
  encabezados: string[],
  color: DdMatrizColor,
  origen: "empresa" | "vinculo",
): ColumnaMatrizExcel[] {
  return codigos.map((codigo, i) => ({
    encabezado: encabezados[i] ?? codigo,
    color,
    ancho: 20,
    valor: (fila) =>
      origen === "empresa"
        ? celdaLista(codigo, fila.empresa.listas, DD_MATRIZ_TIPOS_VINCULO.EMPRESA, fila.empresa.ambito as DdMatrizAmbito)
        : celdaLista(codigo, fila.vinculo.listas, fila.vinculo.tipo as DdMatrizTipoVinculo, fila.vinculo.ambito as DdMatrizAmbito),
  }));
}

const bloque = (fila: DdMatrizEvaluacionExportFilaDTO, area: "sig" | "reputacional" | "compliance"): DdMatrizBloqueDTO =>
  fila.vinculo[area];

const CODIGOS_EMPRESA_NACIONAL = DD_MATRIZ_LISTAS.filter((l) => l.grupo === "empresa_nacional").map((l) => l.codigo);
const CODIGOS_PERSONA = DD_MATRIZ_LISTAS.filter((l) => l.grupo === "persona_vinculada").map((l) => l.codigo);
const CODIGOS_EXTRANJERA = DD_MATRIZ_LISTAS.filter((l) => l.grupo === "extranjera").map((l) => l.codigo);

/** Las 54 columnas (A a BB) de la matriz oficial de evaluacion de debida diligencia. */
export const COLUMNAS_MATRIZ_EXCEL: ColumnaMatrizExcel[] = [
  columnaGeneral("N°", 8, (f) => numeroDe(f.expedienteCodigo)),
  columnaGeneral("FECHA DE INGRESO DE SOLICITUD", 16, (f) => fechaDe(f.fechaIngreso)),
  columnaGeneral("FECHA DE REVISIÓN POR SIG", 16, (f) => fechaDe(f.vinculo.sig.fecha ?? f.fechaRevisionExpediente)),
  columnaGeneral("RESPONSABLE DE REVISIÓN", 22, responsableRevision),
  columnaGeneral("RAZON SOCIAL EMPRESA / PERSONA", 40, (f) => f.empresa.razonSocial),
  columnaGeneral("RUC / ID", 16, (f) => f.empresa.ruc),
  columnaGeneral("EMPRESA NACIONAL O EXTRANJERA", 16, (f) => etiqueta(DD_MATRIZ_AMBITO_LABELS, f.empresa.ambito)),
  columnaGeneral("NACIONALIDAD", 16, (f) => (f.empresa.pais ? nombrePais(f.empresa.pais).toUpperCase() : "")),
  columnaGeneral("ACTIVIDAD ECONÓMICA", 36, (f) => f.empresa.actividadEconomica),
  columnaGeneral("FECHA INICIO DE ACTIVIDADES", 16, (f) => fechaDe(f.empresa.fechaInicioActividades)),
  columnaGeneral("ESTADO DE CONTRIBUYENTE", 20, (f) => f.empresa.estadoContribuyente),
  columnaGeneral("DIRECCIÓN LEGAL", 40, (f) => f.empresa.direccionLegal),
  columnaGeneral("HISTORIAL CON IIMP", 14, (f) => etiqueta(DD_MATRIZ_SI_NO_NA_LABELS, f.empresa.historialIimp)),
  columnaGeneral("BENEFICIO MUTUO", 14, (f) => etiqueta(DD_MATRIZ_SI_NO_NA_LABELS, f.empresa.beneficioMutuo)),
  columnaGeneral("MOTIVO DE LA EVALUACIÓN", 22, (f) => f.empresa.motivo),
  columnaGeneral("EVENTO O PROYECTO ASOCIADO", 18, (f) => f.empresa.eventoProyecto),
  ...columnasLista(
    CODIGOS_EMPRESA_NACIONAL,
    [
      "QUEJAS O REPORTE DESDE INDECOPI",
      "REPORTE CORRUPCIÓN / SOBORNO / LAVADO",
      "REPORTES INFRACCIONES OEFA",
      "REPORTES LISTAS PEPS / PRP",
      "CUMPLE EN CENTRAL DE RIESGO EMPRESA",
      "BANCARIZADO EMPRESA",
    ],
    DD_MATRIZ_COLORES.NACIONAL,
    "empresa",
  ),
  columnaGeneral("REPRESENTANTE LEGAL / OTRAS PERSONAS o EMPRESAS VINCULAS", 38, (f) => (esPersona(f.vinculo.tipo) ? f.vinculo.nombre : "")),
  columnaGeneral("DOCUMENTO DE IDENTIDAD", 22, (f) =>
    esPersona(f.vinculo.tipo) ? [f.vinculo.documento, f.vinculo.tipoDocumento].filter(Boolean).join(" - ") : "",
  ),
  columnaGeneral("NACIONALIDAD (PERSONA)", 16, (f) =>
    esPersona(f.vinculo.tipo) ? (f.vinculo.nacionalidad ?? (f.vinculo.pais ? nombrePais(f.vinculo.pais) : "")) : "",
  ),
  columnaGeneral("CARGO", 20, (f) => (esPersona(f.vinculo.tipo) ? f.vinculo.cargo : "")),
  // AA, AB, AC (naranja), AD (lila: conflicto de interes) y AE (naranja)
  ...columnasLista(
    CODIGOS_PERSONA,
    [
      "HAY REPORTES DE CORRUPCIÓN / SOBORNO / LAVADO",
      "LISTAS PEPS / PRP",
      "CUMPLE EN CENTRAL DE RIESGO REPRESENTANTE LEGAL",
      "HAY CONFLICTOS DE INTERÉS",
      "BANCARIZADO REPRESENTANTES LEGALES U OTROS",
    ],
    DD_MATRIZ_COLORES.NACIONAL,
    "vinculo",
  ).map((columna, i) => (i === 3 ? { ...columna, color: DD_MATRIZ_COLORES.COMUN } : columna)),
  ...columnasLista(
    CODIGOS_EXTRANJERA,
    [
      "REGISTRA ANTECEDENTES EN OFAC",
      "REGISTRA ANTECEDENTES NACIONES UNIDAS",
      "REGISTRA ANTECEDENTES OPENSANCTIONS",
      "REGISTRA ANTECEDENTES OHMYFIN",
      "SANCIONES CANADIENSES",
      "SANCIONES EUROPEOS",
      "SANCIONES UNITED KINGDOM",
      "SANCIONES AUSTRALIAM",
      "LISTA DEL BANCO MUNDIAL DE FIRMAS E INDIVIDUOS INELEGIBLES",
      "REGISTRA ANTECEDENTES EN INTERPOL",
      "REGISTRA ANTECEDENTES EN DEA",
    ],
    DD_MATRIZ_COLORES.EXTRANJERO,
    "vinculo",
  ),
  columnaGeneral("RESULTADO DE LA EVALUACION POR SIG", 18, (f) => etiqueta(DD_MATRIZ_RESULTADO_LABELS, bloque(f, "sig").resultado)),
  columnaGeneral("OBSERVACIONES DE SIG", 40, (f) => bloque(f, "sig").observaciones),
  columnaGeneral("CONCLUSION DE SIG", 28, (f) => etiqueta(DD_MATRIZ_CONCLUSION_LABELS, bloque(f, "sig").conclusion)),
  columnaGeneral("FECHA DE EVALUACIÓN (REPUTACIONAL)", 16, (f) => fechaDe(bloque(f, "reputacional").fecha)),
  columnaGeneral("RESULTADO DE LA EVALUACION REPUTACIONAL", 18, (f) => etiqueta(DD_MATRIZ_RESULTADO_LABELS, bloque(f, "reputacional").resultado)),
  columnaGeneral("OBSERVACIONES REPUTACIONALES", 40, (f) => bloque(f, "reputacional").observaciones),
  columnaGeneral("CONCLUSION REPUTACIONAL", 28, (f) => etiqueta(DD_MATRIZ_CONCLUSION_LABELS, bloque(f, "reputacional").conclusion)),
  columnaGeneral("FECHA DE EVALUACIÓN (COMPLIANCE)", 16, (f) => fechaDe(bloque(f, "compliance").fecha)),
  columnaGeneral("RESULTADO DE LA EVALUACIÓN REFORZADA POR COMPLIANCE", 20, (f) => etiqueta(DD_MATRIZ_RESULTADO_LABELS, bloque(f, "compliance").resultado)),
  columnaGeneral("OBSERVACIONES DE COMPLIANCE", 40, (f) => bloque(f, "compliance").observaciones),
  columnaGeneral("CONCLUSION DE COMPLIANCE", 28, (f) => etiqueta(DD_MATRIZ_CONCLUSION_COMPLIANCE_LABELS, bloque(f, "compliance").conclusion)),
  columnaGeneral("RESULTADO FINAL", 24, (f) => etiqueta(DD_MATRIZ_RESULTADO_FINAL_LABELS, f.vinculo.resultadoFinal)),
];

/** Fila de titulos de grupo (fila 3 de la matriz oficial). */
export const GRUPOS_MATRIZ_EXCEL: GrupoMatrizExcel[] = [
  { titulo: "DATOS GENERALES DE EMPRESA", desde: 0, hasta: 15 },
  { titulo: "LISTAS RESTRICTIVAS EMPRESA NACIONAL", desde: 16, hasta: 21 },
  { titulo: "LISTAS RESTRICTIVAS REPRESENTANTE LEGAL / OTRAS PERSONAS O EMPRESAS VINCULADAS", desde: 22, hasta: 30 },
  { titulo: "LISTAS RESTRICTIVAS EMPRESA o PERSONA EXTRANJERA VINCULADA", desde: 31, hasta: 41 },
  { titulo: "CONCLUSIONES SIG (LOGISTICA)", desde: 42, hasta: 44 },
  { titulo: "CONCLUSIONES REPUTACIONAL (COMUNICACIONES)", desde: 45, hasta: 48 },
  { titulo: "CONCLUSIONES COMPLIANCE (LEGAL)", desde: 49, hasta: 52 },
  { titulo: "CONCLUSION FINAL", desde: 53, hasta: 53 },
];

/** Valores de una fila de la matriz oficial, en el orden de `COLUMNAS_MATRIZ_EXCEL`. */
export function filaMatrizExcel(fila: DdMatrizEvaluacionExportFilaDTO): Celda[] {
  return COLUMNAS_MATRIZ_EXCEL.map((columna) => columna.valor(fila) ?? "");
}

/** Mismas columnas para CSV: las fechas salen como YYYY-MM-DD. */
export const COLUMNAS_MATRIZ_CSV: ColumnaExportacion<DdMatrizEvaluacionExportFilaDTO>[] = COLUMNAS_MATRIZ_EXCEL.map(
  (columna) => ({
    encabezado: columna.encabezado,
    valor: (fila) => {
      const valor = columna.valor(fila);
      return valor instanceof Date ? valor.toISOString().slice(0, 10) : valor;
    },
  }),
);

/** Colores de encabezado (ARGB) iguales a los de la matriz oficial. */
const COLOR_ENCABEZADO: Record<DdMatrizColor, string> = {
  [DD_MATRIZ_COLORES.COMUN]: "FFB4A7D6",
  [DD_MATRIZ_COLORES.NACIONAL]: "FFF6B26B",
  [DD_MATRIZ_COLORES.EXTRANJERO]: "FF9FC5E8",
};

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Arma el libro en el formato de la matriz oficial (titulo, grupos, encabezados de colores y filas). */
export async function armarLibroMatriz(filas: DdMatrizEvaluacionExportFilaDTO[]): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Matriz DD");
  const total = COLUMNAS_MATRIZ_EXCEL.length;
  const borde = { style: "thin" as const, color: { argb: "FF9CA3AF" } };
  const bordes = { top: borde, left: borde, bottom: borde, right: borde };

  ws.mergeCells(1, 1, 1, total);
  const titulo = ws.getCell(1, 1);
  titulo.value = "EVALUACIÓN DE DEBIDA DILIGENCIA";
  titulo.font = { bold: true, size: 16 };
  titulo.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  for (const grupo of GRUPOS_MATRIZ_EXCEL) {
    if (grupo.hasta > grupo.desde) ws.mergeCells(3, grupo.desde + 1, 3, grupo.hasta + 1);
    const celda = ws.getCell(3, grupo.desde + 1);
    celda.value = grupo.titulo;
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    celda.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    celda.border = bordes;
  }
  ws.getRow(3).height = 30;

  COLUMNAS_MATRIZ_EXCEL.forEach((columna, i) => {
    const celda = ws.getCell(4, i + 1);
    celda.value = columna.encabezado;
    celda.font = { bold: true, size: 10 };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ENCABEZADO[columna.color] } };
    celda.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    celda.border = bordes;
    ws.getColumn(i + 1).width = columna.ancho;
  });
  ws.getRow(4).height = 54;

  filas.forEach((fila, indice) => {
    const row = ws.getRow(5 + indice);
    filaMatrizExcel(fila).forEach((valor, i) => {
      const celda = row.getCell(i + 1);
      celda.value = valor;
      celda.alignment = { vertical: "top", wrapText: true };
      celda.border = bordes;
      if (valor instanceof Date) celda.numFmt = "dd/mm/yyyy";
    });
  });

  ws.views = [{ state: "frozen", xSplit: 6, ySplit: 4 }];
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: total } };

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** Descarga las filas en el formato de la matriz oficial (.xlsx) con encabezados de colores. */
export async function exportarMatrizExcel(filas: DdMatrizEvaluacionExportFilaDTO[], nombre: string): Promise<void> {
  const buffer = await armarLibroMatriz(filas);
  archivoUtils.descargarBlob(new Blob([buffer], { type: MIME_XLSX }), nombre);
}
