import type { EmpresaPaisReporte, MapaPabellonesReporte, ReporteExportacion, ReporteSolicitudesPreReservas, ResumenPaisSolicitudes } from "@/domain/models/reportes";

export interface IReportesSolicitudesRepository {
  resumenPorPais(params: { eventoId?: string; incluirInactivas?: boolean }): Promise<ResumenPaisSolicitudes[]>;
  empresasPorPais(params: { eventoId?: string; incluirInactivas?: boolean }): Promise<EmpresaPaisReporte[]>;
  mapaPabellones(params: { eventoId?: string; incluirInactivas?: boolean }): Promise<MapaPabellonesReporte>;
  exportacion(params: { eventoId?: string; incluirInactivas?: boolean }): Promise<ReporteExportacion>;
  exportacionSolicitudesPreReservas(params: { eventoId?: string }): Promise<ReporteSolicitudesPreReservas>;
}
