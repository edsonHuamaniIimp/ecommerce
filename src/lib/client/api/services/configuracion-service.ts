import 'client-only';

import { internalApi } from "./internal-api";
import type { ActualizarNotificacionesSolicitudesRequestDTO } from "@/types/dto/configuracion/actualizar-notificaciones-solicitudes-request.dto";
import type { NotificacionesSolicitudesResponseDTO } from "@/types/dto/configuracion/notificaciones-solicitudes-response.dto";
import type { PortalConfigDTO } from "@/types/dto/configuracion/portal-config.dto";

/** Configuracion publica del portal: lectura abierta; guardado con portal:manage. */
export const configuracionService = {
  obtenerPortal() {
    return internalApi.get<PortalConfigDTO>("/api/portal/config");
  },
  actualizarPortal(data: PortalConfigDTO) {
    return internalApi.post<PortalConfigDTO>("/api/portal/config", data);
  },
  obtenerNotificacionesSolicitudes() {
    return internalApi.get<NotificacionesSolicitudesResponseDTO>("/api/configuracion/notificaciones-solicitudes");
  },
  actualizarNotificacionesSolicitudes(data: ActualizarNotificacionesSolicitudesRequestDTO) {
    return internalApi.post<NotificacionesSolicitudesResponseDTO>("/api/configuracion/notificaciones-solicitudes", data);
  },
};
