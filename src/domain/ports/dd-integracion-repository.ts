import type {
  DdIntegracionBusquedaParams,
  DdIntegracionBusquedaResult,
} from "@/domain/models/dd-integracion";

/** Consulta M2M de empresas y documentos del módulo DD. */
export interface IDdIntegracionRepository {
  buscarDocumentos(params: DdIntegracionBusquedaParams): Promise<DdIntegracionBusquedaResult>;
}
