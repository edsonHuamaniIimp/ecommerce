import 'client-only';

import { internalApi } from "./internal-api";
import type { GessStandDTO, GessSyncResultDTO } from "@/types/dto/models";
import type { PaginatedResponseDTO } from "@/types/dto/pagination.dto";
import type { ReservaRequestDTO, ReservaResponseDTO } from "@/types/dto/reserva";
import type { TipoStandImagenDTO } from "@/types/dto/gess/tipo-stand-imagen.dto";

export const gessService = {
  /** Paginado (para bandejas) */
  list(eventoId: string, params?: { page?: number; per_page?: number; search?: string; estado?: string }) {
    const qs = new URLSearchParams({ eventoId });
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    if (params?.search) qs.set("search", params.search);
    if (params?.estado) qs.set("estado", params.estado);
    return internalApi.get<PaginatedResponseDTO<GessStandDTO>>(`/api/gess/listar?${qs.toString()}`);
  },
  /** Todos los registros (plano, vinculacion); recorre todas las paginas (per_page 1000). */
  async all(eventoId: string) {
    const perPage = 1000;
    const first = await internalApi.get<PaginatedResponseDTO<GessStandDTO>>(`/api/gess/listar?eventoId=${encodeURIComponent(eventoId)}&per_page=${perPage}`);
    const data = [...first.data];
    for (let page = 2; page <= first.pagination.total_pages; page++) {
      const next = await internalApi.get<PaginatedResponseDTO<GessStandDTO>>(`/api/gess/listar?eventoId=${encodeURIComponent(eventoId)}&per_page=${perPage}&page=${page}`);
      data.push(...next.data);
    }
    return data;
  },
  listAll(eventoId: string): Promise<GessStandDTO[]> {
    return this.all(eventoId);
  },
  findByBloque(bloqueId: string) {
    return internalApi.get<GessStandDTO | null>(`/api/gess/listar?bloqueId=${encodeURIComponent(bloqueId)}`);
  },
  vincular(id: string, bloqueId: string | null) {
    return internalApi.patch<GessStandDTO>("/api/gess/actualizar", { id, bloqueId });
  },
  sync(body: { eventoId: string; tipoEvento: number; codigoEvento: number; seleccionadas?: Record<string, unknown>[] }) {
    return internalApi.post<GessSyncResultDTO>("/api/gess/sync", body);
  },
  fetchFromApi(tipoEvento: number, codigoEvento: number) {
    return internalApi.post<Record<string, unknown>[]>("/api/planogess/fetch", { tipoEvento, codigoEvento });
  },
  /** Catalogo de imagenes referenciales por tipo de stand (admin). */
  tiposImagenListar() {
    return internalApi.get<TipoStandImagenDTO[]>("/api/gess/tipos-imagen");
  },
  /** Sube/reemplaza la imagen referencial de un tipo (aplica a todos sus stands). */
  tipoImagenGuardar(body: { tipo: string; imagenUrl: string }) {
    return internalApi.post<{ ok: boolean }>("/api/gess/tipos-imagen", body);
  },
  /** Quita la imagen referencial de un tipo. */
  tipoImagenEliminar(tipo: string) {
    return internalApi.delete<{ ok: boolean }>(`/api/gess/tipos-imagen?tipo=${encodeURIComponent(tipo)}`);
  },
  /** Enviar solicitud de reserva */
  reservar(body: ReservaRequestDTO) {
    return internalApi.post<ReservaResponseDTO>("/api/reservas/crear", body);
  },
  /** Pre-reserva en lote: bloquea stands disponibles con empresa o titulo libre. */
  preReservar(body: { standIds: string[]; razonSocial?: string | null; titulo?: string | null; ruc?: string | null; sie?: string | null; logoUrl?: string | null; nota?: string | null }) {
    return internalApi.post<{ preReservados: number }>("/api/gess/pre-reservar", body);
  },
  /** Libera pre-reservas en lote (vuelven a disponible). */
  liberarPreReserva(standIds: string[]) {
    return internalApi.post<{ liberados: number }>("/api/gess/liberar", { standIds });
  },
  /** Edita empresa/titulo/logo/nota de una pre-reserva vigente. */
  actualizarPreReserva(body: { standId: string; razonSocial?: string | null; titulo?: string | null; ruc?: string | null; sie?: string | null; logoUrl?: string | null; nota?: string | null }) {
    return internalApi.patch<{ actualizado: boolean }>("/api/gess/pre-reserva", body);
  },
};
