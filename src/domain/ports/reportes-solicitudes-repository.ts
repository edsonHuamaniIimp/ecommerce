import type { ResumenPaisSolicitudes } from "@/domain/models/reportes";

export interface IReportesSolicitudesRepository {
  resumenPorPais(params: { eventoId?: string; incluirInactivas?: boolean }): Promise<ResumenPaisSolicitudes[]>;
}
