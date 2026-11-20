import 'client-only';

import { internalApi } from "./internal-api";
import type { RequisitosFacturacionDTO, ArchivoIImpInputDTO, ResultadoSolicitudFacturaDTO } from "./pagos-service";
import type {
  EnviarRecordatoriosRequestDTO,
  EnviarRecordatoriosResultDTO,
  RecordatoriosResponseDTO,
} from "@/types/dto/facturacion";

export const facturacionService = {
  /** Datos de sesion Niubiz para pagar una cuota. */
  sesionNiubizz(facturacionId: string) {
    return internalApi.post<Record<string, unknown>>("/api/facturacion/niubizz/sesion", { facturacionId });
  },

  /** Empresas a notificar: sin solicitud de factura y con documentos declarados pendientes. */
  listarRecordatorios() {
    return internalApi.get<RecordatoriosResponseDTO>("/api/facturacion/recordatorios");
  },

  /** Envia los recordatorios seleccionados (correo con enlace al manual del cliente). */
  enviarRecordatorios(body: EnviarRecordatoriosRequestDTO) {
    return internalApi.post<EnviarRecordatoriosResultDTO>("/api/facturacion/recordatorios/enviar", body);
  },

  /** Facturacion registra la solicitud de factura en nombre del cliente. */
  solicitarFactura(cuotaId: string, requisitos: RequisitosFacturacionDTO, archivos: ArchivoIImpInputDTO[] = []) {
    return internalApi.post<ResultadoSolicitudFacturaDTO>("/api/facturacion/solicitar-factura", {
      cuotaId,
      ...(archivos.length > 0 ? { archivos } : {}),
      requisitos,
    });
  },

  /** Facturacion completa los requisitos de una solicitud ya enviada (sin reenviar la reserva). */
  completarRequisitos(cuotaId: string, requisitos: RequisitosFacturacionDTO, archivos: ArchivoIImpInputDTO[] = []) {
    return internalApi.post<{ ok: boolean }>("/api/facturacion/completar-requisitos", {
      cuotaId,
      ...(archivos.length > 0 ? { archivos } : {}),
      requisitos,
    });
  },
};
