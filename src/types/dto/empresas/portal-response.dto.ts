import type { ApiResponse } from "@/lib/server/api-response";
import type { EmpresaDTO } from "./empresa.dto";

export type MisDatosEmpresaResponse = ApiResponse<EmpresaDTO>;
export type ValidarDatosEmpresaResponse = ApiResponse<EmpresaDTO>;
