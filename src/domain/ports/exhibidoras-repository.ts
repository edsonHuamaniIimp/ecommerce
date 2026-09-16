import type { ExhibidoraDTO } from "@/types/dto/exhibidoras/exhibidoras.dto";

export interface IExhibidorasRepository {
  listar(search?: string): Promise<ExhibidoraDTO[]>;
}
