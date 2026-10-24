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
  /** Nombre del documento notificado por el sistema de facturacion del IIMP (sin enlace de descarga). */
  documentoSie: string | null;
  /** true si el IIMP notifico la anulacion/rechazo del documento (estado 2). */
  documentoSieAnulado: boolean;
  /** Justificacion del IIMP al anular o rechazar el documento; null si no aplica. */
  documentoSieJustificacion: string | null;
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

/** Archivo (link) a registrar en la cuenta corriente del IIMP: OC, HES, detraccion o diferencia. */
export interface ArchivoIImpInputDTO {
  tipo: string;
  /** Obligatoria en DETRACCION y DIFERENCIA; opcional en OC, HES y PAGO_TOTAL. */
  cuota?: number | null;
  link: string;
  nombre?: string | null;
}

/** Resultado de "Solicitar factura": reserva registrada en el IIMP (cuenta corriente creada). */
export interface ResultadoSolicitudFacturaDTO {
  numeroSolicitud: string;
  contrato: string;
  cuentaCorriente: number;
  /** Legado: el IIMP ya no emite comprobantes al reservar (si algun dia vuelve, viene aqui). */
  documento: CuotaPagoDTO["iimpDocumento"];
  /** Payload exacto que el servidor envio al IIMP (visible en la respuesta para validacion). */
  payloadEnviado?: unknown;
}

/** Archivo (link) registrado en la cuenta corriente del IIMP: OC, HES, detraccion o diferencia. */
export interface ArchivoCuentaDTO {
  item: number;
  tipo: string;
  cuota: number | null;
  link: string;
  nombre: string | null;
  fecha: string;
}

/** Fachada cliente de la vista de pagos del exhibidor. */
export const pagosService = {
  listar(params: { page?: number; per_page?: number; empresaId?: string } = {}) {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.per_page) q.set("per_page", String(params.per_page));
    if (params.empresaId) q.set("empresaId", params.empresaId);
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
  /** "Solicitar factura": registra la reserva en el IIMP con sus documentos (el IIMP factura cada cuota en su fecha). */
  solicitarFactura(cuotaId: string, archivos: ArchivoIImpInputDTO[] = []) {
    return internalApi.post<ResultadoSolicitudFacturaDTO>("/api/pagos/solicitar-factura", {
      cuotaId,
      ...(archivos.length > 0 ? { archivos } : {}),
    });
  },
  /** Archivos (links) de la cuenta corriente del IIMP asociada a la cuota. */
  listarArchivos(cuotaId: string) {
    return internalApi.get<ArchivoCuentaDTO[]>(`/api/pagos/archivos?cuotaId=${encodeURIComponent(cuotaId)}`);
  },
  agregarArchivo(body: { cuotaId: string; tipo: string; cuota?: number | null; link: string; nombre?: string | null }) {
    return internalApi.post<ArchivoCuentaDTO[]>("/api/pagos/archivos-agregar", body);
  },
  eliminarArchivo(body: { cuotaId: string; item: number }) {
    return internalApi.post<ArchivoCuentaDTO[]>("/api/pagos/archivos-eliminar", body);
  },
};
