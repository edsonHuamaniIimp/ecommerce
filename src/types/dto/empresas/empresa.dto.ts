import type { ApiResponse } from "@/lib/server/api-response";

/** Empresa exhibidora registrada por el backoffice (respuesta API). */
export interface EmpresaDTO {
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  direccionFiscal: string | null;
  telefono: string | null;
  emailContacto: string | null;
  emailFacturacion: string | null;
  representanteLegalNombre: string | null;
  representanteLegalDni: string | null;
  tipoComprobante: string;
  sitioWeb: string | null;
  estado: string;
  cuentaCreada: boolean;
  primerAccesoCompletado: boolean;
  datosValidadosEn: string | null;
  creadoPor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmpresasPaginatedDTO {
  data: EmpresaDTO[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/** Resultado de crear la cuenta del Portal / reenviar credenciales. */
export interface ResultadoCredencialesEmpresaDTO {
  email: string;
  emailEnviado: boolean;
}

export type EmpresasListResponse = ApiResponse<EmpresasPaginatedDTO>;
export type EmpresaDetalleResponse = ApiResponse<EmpresaDTO>;
export type EmpresaMutacionResponse = ApiResponse<EmpresaDTO>;
