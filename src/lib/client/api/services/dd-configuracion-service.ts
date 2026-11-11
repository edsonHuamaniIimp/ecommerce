import "client-only";

import { internalApi } from "./internal-api";
import type {
  DdAuditoriaItemDTO,
  DdConfiguracionDTO,
  DdConfiguracionRequestDTO,
} from "@/types/dto/debida-diligencia";

const BASE = "/api/debida-diligencia/configuracion";

export const ddConfiguracionService = {
  obtener() {
    return internalApi.get<DdConfiguracionDTO>(BASE);
  },
  actualizar(data: DdConfiguracionRequestDTO) {
    return internalApi.post<DdConfiguracionDTO>(BASE, data);
  },
  auditoria() {
    return internalApi.get<{ data: DdAuditoriaItemDTO[] }>(`${BASE}/auditoria`);
  },
};
