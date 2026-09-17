import 'client-only';

import { internalApi } from "./internal-api";
import type { SgcExpedienteDetalleDTO } from "@/types/dto/sgc/expediente-detalle.dto";
import type { SgcUrlDescargaDTO } from "@/types/dto/sgc/url-descarga.dto";

export const sgcService = {
  detalle(solicitudId: string) {
    return internalApi.get<SgcExpedienteDetalleDTO>(`/api/sgc/detalle?solicitudId=${encodeURIComponent(solicitudId)}`);
  },

  descarga(solicitudId: string) {
    return internalApi.get<SgcUrlDescargaDTO>(`/api/sgc/descarga?solicitudId=${encodeURIComponent(solicitudId)}`);
  },

  subsanar(body: { solicitudId: string; documentId: string; url: string; title?: string }) {
    return internalApi.post<Record<string, unknown>>("/api/sgc/subsanar", body);
  },
};
