import type { EmpresaPaisReporte, MapaPabellonesReporte, ResumenPaisSolicitudes } from "@/domain/models/reportes";

export interface IReportesSolicitudesRepository {
  resumenPorPais(params: { eventoId?: string; incluirInactivas?: boolean }): Promise<ResumenPaisSolicitudes[]>;
  empresasPorPais(params: { eventoId?: string; incluirInactivas?: boolean }): Promise<EmpresaPaisReporte[]>;
  mapaPabellones(params: { eventoId?: string; incluirInactivas?: boolean }): Promise<MapaPabellonesReporte>;
}
