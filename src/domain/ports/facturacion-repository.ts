export interface FacturacionRow {
  id: string;
  solicitudId: string;
  tipo: string;
  estado: string;
  montoTotal: number;
  moneda: string;
  modoPago: string;
  standCode: string;
  correoSolicitante: string | null;
  createdAt: string;
  cuotas: Array<{ id: string; numero: number; monto: number; fechaVencimiento: string | null; estado: string }>;
}

export interface FacturacionListParams {
  page: number;
  perPage: number;
  eventoId?: string;
}

export interface FacturacionListResult {
  data: FacturacionRow[];
  total: number;
}

export interface IFacturacionRepository {
  listar(params: FacturacionListParams): Promise<FacturacionListResult>;
  detalle(id: string): Promise<FacturacionRow | null>;
  agregarCuota(facturacionId: string, monto: number, fechaVencimiento: string | null, createdBy: string): Promise<void>;
  pagarCuota(cuotaId: string, createdBy: string, comprobante: string | null): Promise<void>;
  actualizar(id: string, data: { tipo?: string }, createdBy: string): Promise<void>;
  eliminar(id: string, createdBy: string): Promise<void>;
  eliminarCuota(cuotaId: string, createdBy: string): Promise<void>;
}
