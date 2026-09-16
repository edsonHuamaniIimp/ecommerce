import type { IFacturacionRepository, FacturacionListParams, FacturacionListResult, FacturacionRow } from "@/domain/ports/facturacion-repository";

export class FacturacionApplicationService {
  constructor(private readonly repo: IFacturacionRepository) {}

  async listar(params: FacturacionListParams): Promise<FacturacionListResult> {
    return this.repo.listar(params);
  }

  async detalle(id: string): Promise<FacturacionRow | null> {
    return this.repo.detalle(id);
  }

  async agregarCuota(facturacionId: string, monto: number, fechaVencimiento: string | null, createdBy: string): Promise<void> {
    return this.repo.agregarCuota(facturacionId, monto, fechaVencimiento, createdBy);
  }

  async pagarCuota(cuotaId: string, createdBy: string, comprobante: string | null): Promise<void> {
    return this.repo.pagarCuota(cuotaId, createdBy, comprobante);
  }

  async actualizar(id: string, data: { tipo?: string }, createdBy: string): Promise<void> {
    return this.repo.actualizar(id, data, createdBy);
  }

  async eliminar(id: string, createdBy: string): Promise<void> {
    return this.repo.eliminar(id, createdBy);
  }

  async eliminarCuota(cuotaId: string, createdBy: string): Promise<void> {
    return this.repo.eliminarCuota(cuotaId, createdBy);
  }
}
