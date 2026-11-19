import type {
  DdIntegracionBusquedaParams,
  DdIntegracionBusquedaResult,
} from "@/domain/models/dd-integracion";
import type { IDdIntegracionRepository } from "@/domain/ports/dd-integracion-repository";

/** Caso de uso M2M: documentos DD de empresas por documento o razón social. */
export class DdIntegracionApplicationService {
  constructor(private readonly repo: IDdIntegracionRepository) {}

  buscarDocumentos(params: DdIntegracionBusquedaParams): Promise<DdIntegracionBusquedaResult> {
    return this.repo.buscarDocumentos(params);
  }
}
