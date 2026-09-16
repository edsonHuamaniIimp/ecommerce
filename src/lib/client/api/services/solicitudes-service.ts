import 'client-only';

import { internalApi } from "./internal-api";
import type { SolicitudesPaginatedDTO, SolicitudDTO } from "@/types/dto/solicitudes/solicitudes-response.dto";

interface RevisionSalidaDTO {
  id: string;
  solicitudId: string;
  area: string;
  estado: string;
  comentario: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const solicitudesService = {
  listar(eventoId: string, page: number, perPage: number, search?: string, userId?: string) {
    const qs = new URLSearchParams({ eventoId, page: String(page), per_page: String(perPage) });
    if (search) qs.set("search", search);
    if (userId) qs.set("userId", userId);
    return internalApi.get<SolicitudesPaginatedDTO>(`/api/solicitudes/listar?${qs.toString()}`);
  },

  detalle(id: string) {
    return internalApi.get<SolicitudDTO>(`/api/solicitudes/detalle?id=${id}`);
  },

  revisar(body: { solicitudId: string; area: string; estado: string; comentario?: string }) {
    return internalApi.post<RevisionSalidaDTO>(`/api/solicitudes/revisar`, body);
  },

  notificar(body: { solicitudId: string; to: string; modo: "automatico" | "personalizado"; mensaje?: string }) {
    return internalApi.post<{ ok: boolean }>(`/api/solicitudes/notificar`, body);
  },

  modificar(body: { solicitudId: string; documentos?: string[] }) {
    return internalApi.post<{ ok: boolean }>(`/api/solicitudes/modificar`, body);
  },

  reevaluar(body: { solicitudId: string; motivo?: string; documentos?: string[] }) {
    return internalApi.post<Record<string, unknown>>(`/api/solicitudes/reevaluar`, body);
  },

  darDeBaja(body: { solicitudId: string }) {
    return internalApi.post<{ ok: boolean }>(`/api/solicitudes/baja`, body);
  },

  ordenPago(body: { solicitudId: string }) {
    return internalApi.post<{ ok: boolean }>(`/api/solicitudes/orden-pago`, body);
  },

  atenderReevaluacion(body: { reevaluacionId: string; accion: "aprobar" | "rechazar" }) {
    return internalApi.post<{ ok: boolean }>(`/api/solicitudes/atender-reevaluacion`, body);
  },

  uploadDocumento(body: { solicitudId: string; url: string; nombre: string }) {
    return internalApi.post<Record<string, unknown>>(`/api/solicitudes/upload-doc`, body);
  },

  async subirArchivo(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json() as { success?: boolean; data?: { url: string } };
    if (!json.success || !json.data?.url) throw new Error("Error al subir archivo");
    return json.data.url;
  },

  eliminarDocumento(docId: string) {
    return internalApi.post<{ ok: boolean }>(`/api/solicitudes/eliminar-doc`, { docId });
  },

  historial(gessStandId: string) {
    return internalApi.get<Record<string, unknown>[]>(`/api/solicitudes/historial?id=${gessStandId}`);
  },
};
