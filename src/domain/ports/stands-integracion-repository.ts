import type { StandExhibidoraDTO, ContratoStandDTO } from "@/types/dto/stands/stands-integracion.dto";

export interface IStandsIntegracionRepository {
  listarStandsExhibidora(empresaId: string, tipoEvento?: number, codigoEvento?: number): Promise<StandExhibidoraDTO[]>;
  listarContratos(tipoEvento?: number, codigoEvento?: number): Promise<ContratoStandDTO[]>;
}
