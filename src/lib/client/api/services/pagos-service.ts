import 'client-only';

import { internalApi } from "./internal-api";
import type { ComprobanteFiscalDTO } from "@/types/dto/facturacion";

export interface CuotaPagoDTO {
  id: string;
  numero: number;
  monto: number;
  fechaVencimiento: string | null;
  estado: string;
  comprobante: string | null;
  comprobanteFiscal: ComprobanteFiscalDTO | null;
  /** Documento fiscal emitido por el IIMP (1ra cuota al reservar; resto en su fecha). */
  iimpDocumento: {
    tipoDocumento: string;
    serie: string;
    numero: number;
    fechaEmision: string;
    tipoCambio: string;
    igv: string;
    total: string;
  } | null;
}

export interface PagoRowDTO {
  id: string;
  solicitudId: string;
  tipo: string;
  estado: string;
  montoTotal: number;
  moneda: string;
  modoPago: string;
  /** El plan de pago lo definio el cliente en el contrato: no editable. */
  planCliente: boolean;
  standCode: string;
  correoSolicitante: string | null;
  /** Reserva oficial en el IIMP (null = aun no solicitada desde Mis pagos). */
  iimpContrato: string | null;
  iimpCuentaCorriente: string | null;
  createdAt: string;
  cuotas: CuotaPagoDTO[];
}

export interface PagosListResult {
  data: PagoRowDTO[];
  total: number;
}

/** Resultado de "Solicitar factura": reserva registrada en el IIMP y documento de la 1ra cuota. */
export interface ResultadoSolicitudFacturaDTO {
  contrato: string;
  cuentaCorriente: number;
  documento: CuotaPagoDTO["iimpDocumento"];
}

/** Fachada cliente de la vista de pagos del exhibidor. */
export const pagosService = {
  listar(params: { page?: number; per_page?: number } = {}) {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.per_page) q.set("per_page", String(params.per_page));
    const qs = q.toString();
    return internalApi.get<PagosListResult>(`/api/pagos/listar${qs ? `?${qs}` : ""}`);
  },
  detalle(id: string) {
    return internalApi.get<PagoRowDTO>(`/api/pagos/detalle?id=${encodeURIComponent(id)}`);
  },
  agregarCuota(body: { facturacionId: string; monto: number; fechaVencimiento?: string | null }) {
    return internalApi.post<{ ok: boolean }>("/api/pagos/agregar-cuota", body);
  },
  actualizarCuota(body: { cuotaId: string; monto?: number; fechaVencimiento?: string | null }) {
    return internalApi.post<{ ok: boolean }>("/api/pagos/actualizar-cuota", body);
  },
  eliminarCuota(cuotaId: string) {
    return internalApi.post<{ ok: boolean }>("/api/pagos/eliminar-cuota", { cuotaId });
  },
  adjuntarVoucher(body: { cuotaId: string; comprobante: string }) {
    return internalApi.post<{ ok: boolean }>("/api/pagos/adjuntar-voucher", body);
  },
  /** "Solicitar factura": registra la reserva en el IIMP y emite la factura de la 1ra cuota. */
  solicitarFactura(cuotaId: string) {
    return internalApi.post<ResultadoSolicitudFacturaDTO>("/api/pagos/solicitar-factura", { cuotaId });
  },
};
