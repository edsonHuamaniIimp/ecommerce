import 'client-only';

import type { CrearSolicitudCuentaRequestDTO } from "@/types/dto/solicitud-cuenta/crear-solicitud-cuenta-request.dto";
import type { CrearSolicitudCuentaResult } from "@/types/dto/solicitud-cuenta/crear-solicitud-cuenta-result.dto";
import type { RevisarSolicitudCuentaRequestDTO } from "@/types/dto/solicitud-cuenta/revisar-solicitud-cuenta-request.dto";
import type { RevisarSolicitudCuentaResult } from "@/types/dto/solicitud-cuenta/revisar-solicitud-cuenta-result.dto";
import type { ListarSolicitudesCuentaResult } from "@/types/dto/solicitud-cuenta/listar-solicitudes-cuenta-result.dto";
import { internalApi } from "./internal-api";

export const solicitudCuentaService = {
  crear(body: CrearSolicitudCuentaRequestDTO) {
    return internalApi.post<CrearSolicitudCuentaResult>("/api/auth/solicitar-cuenta", body);
  },
  listar(estado?: string) {
    const query = estado ? `?estado=${encodeURIComponent(estado)}` : "";
    return internalApi.get<ListarSolicitudesCuentaResult>(`/api/solicitudes-cuenta/listar${query}`);
  },
  revisar(body: RevisarSolicitudCuentaRequestDTO) {
    return internalApi.patch<RevisarSolicitudCuentaResult>("/api/solicitudes-cuenta/revisar", body);
  },
};
