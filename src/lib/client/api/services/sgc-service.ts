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

  subirDocumento(body: { solicitudId: string; category: string; title: string; url: string; documentId?: string | null }) {
    return internalApi.post<Record<string, unknown>>("/api/sgc/subir-documento", body);
  },

  subirAnexos(solicitudId: string) {
    return internalApi.post<{ enviados: number }>("/api/sgc/subir-anexos", { solicitudId });
  },

  subirContrato(solicitudId: string) {
    return internalApi.post<Record<string, unknown>>("/api/sgc/subir-contrato", { solicitudId });
  },

  registrar(solicitudId: string) {
    return internalApi.post<Record<string, unknown>>("/api/sgc/registrar", { solicitudId });
  },

  /** Declara la casuística de subsanación (la elige el admin cuando el SGC devuelve el trámite). */
  declararMotivo(body: { solicitudId: string; motivo: string | null }) {
    return internalApi.post<Record<string, unknown>>("/api/sgc/subsanacion-motivo", body);
  },

  /** Reenvía al SGC con el contrato firmado del cliente (reabre la ronda). */
  reenviar(solicitudId: string) {
    return internalApi.post<Record<string, unknown>>("/api/sgc/reenviar", { solicitudId });
  },
};
