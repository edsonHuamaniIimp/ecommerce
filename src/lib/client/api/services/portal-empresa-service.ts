import 'client-only';

import { internalApi } from "./internal-api";
import type { EmpresaDTO, ValidarDatosEmpresaRequestDTO } from "@/types/dto/empresas";

/** Empresa del propio usuario (Portal del Cliente). */
export const portalEmpresaService = {
  misDatos() {
    return internalApi.get<EmpresaDTO>("/api/portal/empresa/mis-datos");
  },

  validarDatos(body: ValidarDatosEmpresaRequestDTO) {
    return internalApi.post<EmpresaDTO>("/api/portal/empresa/validar", body);
  },
};
