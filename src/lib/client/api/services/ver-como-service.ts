import "client-only";

import { internalApi } from "./internal-api";
import type {
  EmpresaVerComoDTO,
  EmpresasVerComoBusquedaDTO,
} from "@/types/dto/ver-como/empresa-ver-como.dto";

/** Fachada cliente del modo "Ver como" (solo administradores). */
export const verComoService = {
  buscarEmpresas(search?: string) {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    const sufijo = qs.toString() ? `?${qs.toString()}` : "";
    return internalApi.get<EmpresasVerComoBusquedaDTO>(`/api/ver-como/empresas${sufijo}`);
  },

  seleccionar(empresaId: string) {
    return internalApi.post<EmpresaVerComoDTO>("/api/ver-como/seleccionar", { empresaId });
  },
};
