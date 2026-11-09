import 'client-only';

import { internalApi } from "./internal-api";
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
};
