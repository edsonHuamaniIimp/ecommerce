"use client";

import "client-only";

import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import {
  DD_DOCUMENTO_ADICIONAL,
  DD_DOCUMENTO_VIGENCIA,
  DD_DOCUMENTOS_REQUERIDOS,
  DD_ESTADO_LABELS,
  DD_EVENTO_TODOS,
  DD_ORIGEN_LABELS,
  DD_VINCULO_LABELS,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { etiquetaTipoDocumentoEmpresa } from "@/lib/shared/utils/documento-empresa";
import {
  exportarTablaCsv,
  exportarTablaExcel,
  nombreArchivoExport,
  type ColumnaExportacion,
} from "@/lib/shared/utils/export-tabla";
import type { DdBandejaQueryDTO, DdBandejaRowDTO } from "@/types/dto/debida-diligencia";

/** Columnas de documentos del expediente para la exportacion (una por tipo, con su URL). */
const COLUMNAS_DOCUMENTOS = [
  ...DD_DOCUMENTOS_REQUERIDOS.map((documento) => ({ tipo: documento.tipo, titulo: documento.titulo })),
  { tipo: DD_DOCUMENTO_VIGENCIA.tipo, titulo: DD_DOCUMENTO_VIGENCIA.titulo },
  { tipo: DD_DOCUMENTO_ADICIONAL.tipo, titulo: DD_DOCUMENTO_ADICIONAL.titulo },
];

/** URL absoluta de la version principal del documento en el sistema. */
function urlDocumentoEnSistema(url: string): string {
  const ruta = url.trim();
  if (!ruta) return "";
  if (/^https?:\/\//i.test(ruta)) return ruta;
  if (typeof window === "undefined") return ruta;
  return `${window.location.origin}${ruta.startsWith("/") ? "" : "/"}${ruta}`;
}

/** Valor exportable: solo la URL de la version principal del documento. */
function valorDocumentoExportacion(fila: DdBandejaRowDTO, tipo: string): string {
  const documento = fila.documentos.find((item) => item.tipo === tipo);
  if (!documento) return "No cargado";
  return urlDocumentoEnSistema(documento.url) || "Sin URL";
}

type FilaExportacion = DdBandejaRowDTO & {
  vinculoExportacion: string;
  beneficiariosNombres: string;
  beneficiariosDocumentos: string;
  beneficiariosNacionalidades: string;
  beneficiariosPorcentajes: string;
};

const unir = (valores: string[]) => valores.filter((valor) => valor.trim().length > 0).join(" | ");

/** Una fila por expediente: los vinculos multiples y los beneficiarios van en la misma celda. */
function aFilaExportacion(fila: DdBandejaRowDTO): FilaExportacion {
  const beneficiarios = fila.beneficiarios ?? [];
  return {
    ...fila,
    vinculoExportacion:
      fila.tipoRelacionComercial.length > 0
        ? unir(fila.tipoRelacionComercial.map((vinculo) => DD_VINCULO_LABELS[vinculo] ?? vinculo))
        : "-",
    beneficiariosNombres: unir(beneficiarios.map((b) => b.nombre)),
    beneficiariosDocumentos: unir(beneficiarios.map((b) => b.documento)),
    beneficiariosNacionalidades: unir(beneficiarios.map((b) => b.nacionalidad)),
    beneficiariosPorcentajes: unir(beneficiarios.map((b) => `${b.porcentaje}%`)),
  };
}

/**
 * Exporta los expedientes de DD (una fila por empresa) con los enlaces a sus documentos.
 * Recorre todas las paginas que cumplen los filtros; devuelve la cantidad de filas exportadas
 * (0 si no hubo nada que exportar).
 */
export async function exportarExpedientesDd(
  filtros: Omit<DdBandejaQueryDTO, "page" | "perPage">,
  formato: "csv" | "xlsx",
): Promise<number> {
  const perPage = 100;
  const consulta = (page: number): DdBandejaQueryDTO => ({
    ...filtros,
    eventoId: filtros.eventoId && filtros.eventoId !== DD_EVENTO_TODOS ? filtros.eventoId : undefined,
    search: filtros.search?.trim() || undefined,
    page,
    perPage,
  });

  const primera = await debidaDiligenciaService.bandeja(consulta(1));
  const filas: DdBandejaRowDTO[] = [...primera.data];
  for (let page = 2; page <= primera.totalPages; page += 1) {
    filas.push(...(await debidaDiligenciaService.bandeja(consulta(page))).data);
  }
  if (filas.length === 0) return 0;

  const filasExportacion = filas.map(aFilaExportacion);
  const columnas: ColumnaExportacion<FilaExportacion>[] = [
    { encabezado: "Empresa", valor: (r) => r.empresa.razonSocial },
    { encabezado: "Tipo documento", valor: (r) => etiquetaTipoDocumentoEmpresa(r.empresa.tipoDocumento, r.empresa.ruc) },
    { encabezado: "Documento", valor: (r) => r.empresa.ruc },
    { encabezado: "Expediente", valor: (r) => r.codigo },
    { encabezado: "Evento", valor: (r) => r.eventoNombre },
    { encabezado: "Procedencia", valor: (r) => DD_ORIGEN_LABELS[r.origen] ?? r.origen },
    { encabezado: "Vínculo", valor: (r) => r.vinculoExportacion },
    { encabezado: "Motivo importación", valor: (r) => r.motivoImportacion ?? "" },
    { encabezado: "Estado", valor: (r) => DD_ESTADO_LABELS[r.estado] ?? r.estado },
    { encabezado: "Inicio solicitud", valor: (r) => (r.fechaInicio ? dateUtils.format(r.fechaInicio) : "") },
    { encabezado: "Solicitudes de exhibidores", valor: (r) => r.solicitudesAlquiler },
    { encabezado: "Estado origen", valor: (r) => r.estadoOrigen ?? "" },
    { encabezado: "Proyecto", valor: (r) => r.eventoProyecto ?? "" },
    { encabezado: "Documentos", valor: (r) => `${r.documentoCargados}/${r.documentoTotal}` },
    ...COLUMNAS_DOCUMENTOS.map((documento) => ({
      encabezado: documento.titulo,
      valor: (r: FilaExportacion) => valorDocumentoExportacion(r, documento.tipo),
    })),
    { encabezado: "Enviado", valor: (r) => (r.fechaEnvio ? dateUtils.format(r.fechaEnvio) : "") },
    { encabezado: "Aprobado", valor: (r) => (r.fechaAprobacion ? dateUtils.format(r.fechaAprobacion) : "") },
    { encabezado: "Fecha a caducar", valor: (r) => (r.fechaVencimiento ? dateUtils.format(r.fechaVencimiento) : "") },
    { encabezado: "Beneficiarios finales", valor: (r) => r.beneficiariosNombres },
    { encabezado: "Documento beneficiario", valor: (r) => r.beneficiariosDocumentos },
    { encabezado: "Nacionalidad beneficiario", valor: (r) => r.beneficiariosNacionalidades },
    { encabezado: "Participación beneficiario", valor: (r) => r.beneficiariosPorcentajes },
  ];
  /* Con un solo evento filtrado la columna Evento es redundante. */
  const visibles = columnas.filter(
    (columna) => columna.encabezado !== "Evento" || !consulta(1).eventoId,
  );

  if (formato === "csv") {
    exportarTablaCsv(filasExportacion, visibles, nombreArchivoExport("dd-expedientes", "csv"));
  } else {
    await exportarTablaExcel(filasExportacion, visibles, nombreArchivoExport("dd-expedientes", "xlsx"), "DD Expedientes");
  }
  return filasExportacion.length;
}
