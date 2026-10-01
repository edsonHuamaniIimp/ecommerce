import 'client-only';

import { internalApi } from "./internal-api";
import type { EmpresaDTO } from "@/types/dto/empresas/empresa.dto";
import type { ValidarDatosEmpresaRequestDTO } from "@/types/dto/empresas/portal.dto";

/** Empresa del propio usuario (Portal del Cliente). */
export const portalEmpresaService = {
  misDatos() {
    return internalApi.get<EmpresaDTO>("/api/portal/empresa/mis-datos");
  },

  validarDatos(body: ValidarDatosEmpresaRequestDTO) {
    return internalApi.post<EmpresaDTO>("/api/portal/empresa/validar", body);
  },
};
