import 'client-only';

import { internalApi } from "./internal-api";
import type { PortalConfigDTO } from "@/types/dto/configuracion/portal-config.dto";

/** Configuracion publica del portal: lectura abierta; guardado con portal:manage. */
export const configuracionService = {
  obtenerPortal() {
    return internalApi.get<PortalConfigDTO>("/api/portal/config");
  },
  actualizarPortal(data: PortalConfigDTO) {
    return internalApi.post<PortalConfigDTO>("/api/portal/config", data);
  },
};
