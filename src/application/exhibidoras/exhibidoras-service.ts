import type { IExhibidorasRepository } from "@/domain/ports/exhibidoras-repository";
import type { ExhibidoraDTO } from "@/types/dto/exhibidoras/exhibidoras.dto";

export class ExhibidorasApplicationService {
  constructor(private readonly repo: IExhibidorasRepository) {}

  async listar(search?: string): Promise<ExhibidoraDTO[]> {
    return this.repo.listar(search);
  }
}
