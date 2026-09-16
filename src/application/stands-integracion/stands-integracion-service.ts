import type { IStandsIntegracionRepository } from "@/domain/ports/stands-integracion-repository";
import type { StandExhibidoraDTO, ContratoStandDTO } from "@/types/dto/stands/stands-integracion.dto";

export class StandsIntegracionApplicationService {
  constructor(private readonly repo: IStandsIntegracionRepository) {}

  async listarStandsExhibidora(empresaId: string, tipoEvento?: number, codigoEvento?: number): Promise<StandExhibidoraDTO[]> {
    return this.repo.listarStandsExhibidora(empresaId, tipoEvento, codigoEvento);
  }

  async listarContratos(tipoEvento?: number, codigoEvento?: number): Promise<ContratoStandDTO[]> {
    return this.repo.listarContratos(tipoEvento, codigoEvento);
  }
}
