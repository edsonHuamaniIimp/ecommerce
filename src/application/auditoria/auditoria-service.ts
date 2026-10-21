import type { IAuditoriaRepository, AuditoriaEvento } from "@/domain/ports/auditoria-repository";

/** Servicio central de auditoria. */
export class AuditoriaApplicationService {
  constructor(private readonly repo: IAuditoriaRepository) {}

  async registrar(evento: AuditoriaEvento): Promise<void> {
    await this.repo.registrar(evento);
  }
}
