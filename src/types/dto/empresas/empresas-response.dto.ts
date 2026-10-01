import type { ApiResponse } from "@/lib/server/api-response";
import type { EmpresaDTO } from "./empresa.dto";
import type { EmpresasPaginatedDTO } from "./empresas-paginated.dto";

export type EmpresasListResponse = ApiResponse<EmpresasPaginatedDTO>;
export type EmpresaDetalleResponse = ApiResponse<EmpresaDTO>;
export type EmpresaMutacionResponse = ApiResponse<EmpresaDTO>;
