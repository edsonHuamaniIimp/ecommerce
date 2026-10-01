import type { ApiResponse } from "@/lib/server/api-response";

/** Fila cruda del archivo de carga masiva (texto). */
export interface FilaCargaEmpresaDTO {
  numero: number;
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  direccionFiscal: string;
  telefono: string;
  emailContacto: string;
  emailFacturacion: string;
  representanteLegalNombre: string;
  representanteLegalDni: string;
  tipoComprobante: string;
  sitioWeb: string;
}

/** Fila validada (estado: lista | advertencia | error) con sus motivos. */
export interface FilaCargaValidadaDTO extends FilaCargaEmpresaDTO {
  estado: string;
  mensajes: string[];
}

export interface ResumenCargaEmpresasDTO {
  listas: number;
  advertencias: number;
  errores: number;
}

export interface PrevisualizacionCargaEmpresasDTO {
  filas: FilaCargaValidadaDTO[];
  resumen: ResumenCargaEmpresasDTO;
}

export interface ImportarCargaEmpresasRequestDTO {
  filas: FilaCargaEmpresaDTO[];
}

export interface ResultadoImportacionEmpresasDTO {
  creadas: number;
  omitidas: number;
}

export type PrevisualizacionCargaResponse = ApiResponse<PrevisualizacionCargaEmpresasDTO>;
export type ImportarCargaResponse = ApiResponse<ResultadoImportacionEmpresasDTO>;
