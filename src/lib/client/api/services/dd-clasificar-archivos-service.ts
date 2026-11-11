import "client-only";

import { internalApi } from "./internal-api";
import type {
  DdClasificarArchivosRequestDTO,
  DdClasificarArchivosResponseDTO,
} from "@/types/dto/debida-diligencia";

const BASE = "/api/debida-diligencia/clasificar-archivos";

/** Fachada cliente del asistente de clasificación de evidencias por nombre. */
export const ddClasificarArchivosService = {
  clasificar(body: DdClasificarArchivosRequestDTO) {
    return internalApi.post<DdClasificarArchivosResponseDTO>(BASE, body);
  },
};
