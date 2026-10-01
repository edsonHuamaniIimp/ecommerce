import type { ApiResponse } from "@/lib/server/api-response";
import type { PrevisualizacionCargaEmpresasDTO } from "./previsualizacion-carga-empresas.dto";
import type { ResultadoImportacionEmpresasDTO } from "./resultado-importacion-empresas.dto";

export type PrevisualizacionCargaResponse = ApiResponse<PrevisualizacionCargaEmpresasDTO>;
export type ImportarCargaResponse = ApiResponse<ResultadoImportacionEmpresasDTO>;
