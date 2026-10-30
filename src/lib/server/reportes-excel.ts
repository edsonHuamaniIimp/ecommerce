import ExcelJS from "exceljs";
import { ESTADOS_SOLICITUD_LABELS } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { nombrePais } from "@/lib/shared/utils/pais";
import type { ReporteExportacion } from "@/domain/models/reportes";

interface MetadataExportacion {
  eventoId?: string;
  incluirInactivas: boolean;
  generadoEn: Date;
}

function textoEstado(estado: string | null): string {
  if (!estado) return "";
  return ESTADOS_SOLICITUD_LABELS[estado as keyof typeof ESTADOS_SOLICITUD_LABELS] ?? estado;
}

function siNo(valor: boolean): string {
  return valor ? "SI" : "NO";
}

function agregarHoja(
  workbook: ExcelJS.Workbook,
  nombre: string,
  columnas: Array<{ header: string; key: string; width?: number }>,
  filas: Array<Record<string, string | number | null>>,
): void {
  const hoja = workbook.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
  hoja.columns = columnas.map((columna) => ({
    header: columna.header,
    key: columna.key,
    width: columna.width ?? Math.max(14, columna.header.length + 4),
  }));
  hoja.addRows(filas);
  hoja.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
  hoja.eachRow((fila, indice) => {
    if (indice > 1) fila.alignment = { vertical: "top", wrapText: false };
  });
}

export async function construirExcelReporte(
  data: ReporteExportacion,
  metadata: MetadataExportacion,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "IIMP ContratosStands";
  workbook.created = metadata.generadoEn;

  const resumen = [
    { campo: "Generado", valor: dateUtils.formatDateTime(metadata.generadoEn.toISOString()) },
    { campo: "Evento", valor: metadata.eventoId ?? "Todos" },
    { campo: "Alcance", valor: metadata.incluirInactivas ? "Activas e inactivas" : "Solo activas" },
    { campo: "Empresas", valor: data.empresas.length },
    { campo: "Solicitudes", valor: data.solicitudes.length },
    { campo: "Stands", valor: data.stands.length },
    { campo: "Solicitudes activas", valor: data.solicitudes.filter((fila) => fila.activa).length },
    { campo: "Solicitudes inactivas", valor: data.solicitudes.filter((fila) => !fila.activa).length },
    { campo: "Stands activos", valor: data.stands.filter((fila) => fila.activa).length },
    { campo: "Stands inactivos", valor: data.stands.filter((fila) => !fila.activa).length },
  ];
  agregarHoja(workbook, "Resumen", [
    { header: "Campo", key: "campo", width: 28 },
    { header: "Valor", key: "valor", width: 32 },
  ], resumen);

  agregarHoja(workbook, "Empresas", [
    { header: "Pais", key: "pais", width: 22 },
    { header: "Codigo pais", key: "codigoPais", width: 14 },
    { header: "RUC / RUT", key: "ruc", width: 20 },
    { header: "Tipo documento", key: "tipoDocumento", width: 18 },
    { header: "Razon social", key: "razonSocial", width: 42 },
    { header: "Estado", key: "estado", width: 16 },
    { header: "Solicitudes", key: "solicitudes", width: 14 },
    { header: "Activas", key: "solicitudesActivas", width: 12 },
    { header: "Inactivas", key: "solicitudesInactivas", width: 12 },
    { header: "Datos validados", key: "datosValidadosEn", width: 22 },
  ], data.empresas.map((fila) => ({
    pais: fila.pais ? nombrePais(fila.pais) : "Sin pais",
    codigoPais: fila.pais ?? "",
    ruc: fila.ruc ?? "",
    tipoDocumento: fila.tipoDocumento ?? "",
    razonSocial: fila.razonSocial,
    estado: fila.estado ?? "",
    solicitudes: fila.solicitudes,
    solicitudesActivas: fila.solicitudesActivas,
    solicitudesInactivas: fila.solicitudesInactivas,
    datosValidadosEn: fila.datosValidadosEn ? dateUtils.formatDateTime(fila.datosValidadosEn) : "",
  })));

  agregarHoja(workbook, "Solicitudes", [
    { header: "ID solicitud", key: "id", width: 38 },
    { header: "Empresa", key: "empresa", width: 38 },
    { header: "RUC / RUT", key: "ruc", width: 18 },
    { header: "Pais", key: "pais", width: 22 },
    { header: "Codigo pais", key: "codigoPais", width: 13 },
    { header: "Estado", key: "estado", width: 20 },
    { header: "Activa", key: "activa", width: 10 },
    { header: "Stands", key: "standCodes", width: 30 },
    { header: "Cantidad stands", key: "cantidadStands", width: 16 },
    { header: "Pabellones", key: "pabellones", width: 34 },
    { header: "Tipo stand", key: "tipoStand", width: 20 },
    { header: "Precio USD", key: "precio", width: 14 },
    { header: "Usuario", key: "usuario", width: 32 },
    { header: "Correo", key: "email", width: 34 },
    { header: "Creada", key: "createdAt", width: 22 },
    { header: "Actualizada", key: "updatedAt", width: 22 },
  ], data.solicitudes.map((fila) => ({
    id: fila.id,
    empresa: fila.empresa ?? "",
    ruc: fila.ruc ?? "",
    pais: fila.pais ? nombrePais(fila.pais) : "Sin pais",
    codigoPais: fila.pais ?? "",
    estado: textoEstado(fila.estado),
    activa: siNo(fila.activa),
    standCodes: fila.standCodes.join(", "),
    cantidadStands: fila.standCodes.length,
    pabellones: fila.pabellones.join(", "),
    tipoStand: fila.tipoStand ?? "",
    precio: fila.precio,
    usuario: fila.usuario ?? "",
    email: fila.email ?? "",
    createdAt: dateUtils.formatDateTime(fila.createdAt),
    updatedAt: dateUtils.formatDateTime(fila.updatedAt),
  })));

  agregarHoja(workbook, "Stands", [
    { header: "ID solicitud", key: "solicitudId", width: 38 },
    { header: "Empresa", key: "empresa", width: 38 },
    { header: "RUC / RUT", key: "ruc", width: 18 },
    { header: "Pais", key: "pais", width: 22 },
    { header: "Codigo pais", key: "codigoPais", width: 13 },
    { header: "Stand comercial", key: "standCode", width: 18 },
    { header: "Bloque interno", key: "bloqueId", width: 18 },
    { header: "Pabellon", key: "pabellon", width: 30 },
    { header: "Estado solicitud", key: "estadoSolicitud", width: 20 },
    { header: "Activa", key: "activa", width: 10 },
    { header: "Tipo stand", key: "tipoStand", width: 20 },
    { header: "Precio USD", key: "precio", width: 14 },
  ], data.stands.map((fila) => ({
    solicitudId: fila.solicitudId,
    empresa: fila.empresa ?? "",
    ruc: fila.ruc ?? "",
    pais: fila.pais ? nombrePais(fila.pais) : "Sin pais",
    codigoPais: fila.pais ?? "",
    standCode: fila.standCode ?? "",
    bloqueId: fila.bloqueId ?? "",
    pabellon: fila.pabellon ?? "",
    estadoSolicitud: textoEstado(fila.estadoSolicitud),
    activa: siNo(fila.activa),
    tipoStand: fila.tipoStand ?? "",
    precio: fila.precio,
  })));

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
