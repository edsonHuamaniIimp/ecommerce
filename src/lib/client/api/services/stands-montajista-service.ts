import 'client-only';

import { internalApi } from "./internal-api";
import type { AsignarMontajistaInput, AsignacionMontajistaDTO, EmpresaMontajistaDTO } from "@/types/dto/stands/stands-integracion.dto";

/** Fachada cliente de la asignacion de empresa montajista por stand. */
export const standsMontajistaService = {
  empresas(q?: string) {
    const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    return internalApi.get<EmpresaMontajistaDTO[]>(`/api/empresas-montajistas${qs}`);
  },
  asignar(body: AsignarMontajistaInput) {
    return internalApi.post<AsignacionMontajistaDTO>("/api/stands/asignar-montajista", body);
  },
};
