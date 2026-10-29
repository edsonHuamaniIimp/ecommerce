import { API_ERROR_CODES, PERMISSIONS } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import type { IReportesSolicitudesRepository } from "@/domain/ports/reportes-solicitudes-repository";
import type { EmpresaPaisReporte, ResumenPaisSolicitudes } from "@/domain/models/reportes";

export class ReportesSolicitudesApplicationService {
  constructor(private readonly repo: IReportesSolicitudesRepository) {}

  private autorizar(permissions: string[]): void {
    if (!permissions.includes(PERMISSIONS.REPORTES_VIEW) && !permissions.includes(PERMISSIONS.ADMIN_FULL)) {
      throw new DomainError("Sin permiso para ver reportes", API_ERROR_CODES.FORBIDDEN, 403);
    }
  }

  async resumenPorPais(
    params: { eventoId?: string; incluirInactivas?: boolean },
    permissions: string[],
  ): Promise<ResumenPaisSolicitudes[]> {
    this.autorizar(permissions);
    return this.repo.resumenPorPais(params);
  }

  async empresasPorPais(
    params: { eventoId?: string; incluirInactivas?: boolean },
    permissions: string[],
  ): Promise<EmpresaPaisReporte[]> {
    this.autorizar(permissions);
    return this.repo.empresasPorPais(params);
  }
}
