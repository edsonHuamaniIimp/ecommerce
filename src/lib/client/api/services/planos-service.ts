import 'client-only';

import { internalApi } from "./internal-api";
import type { PlanoDTO, PlanoListItemDTO, PlanoExportDTO, PlanoTsExportDTO, SeccionOcupacionDTO, PlanoSeccionDTO, PlanoPublicoPayloadDTO } from "@/types/dto/planos/planos-response.dto";
import type { TipoPlano } from "@/lib/shared/constants";

export const planosService = {
  listar() {
    return internalApi.get<PlanoListItemDTO[]>("/api/planos/listar");
  },
  publico(params: { codigo?: string; eventoId?: string; tipoEvento?: number; codigoEvento?: number }) {
    const qs = new URLSearchParams();
    if (params.codigo) qs.set("codigo", params.codigo);
    if (params.eventoId) qs.set("eventoId", params.eventoId);
    if (params.tipoEvento !== undefined) qs.set("tipoEvento", String(params.tipoEvento));
    if (params.codigoEvento !== undefined) qs.set("codigoEvento", String(params.codigoEvento));
    return internalApi.get<PlanoPublicoPayloadDTO>(`/api/planos/publico?${qs.toString()}`);
  },
  detalle(id: string) {
    return internalApi.get<PlanoDTO>(`/api/planos/detalle?id=${encodeURIComponent(id)}`);
  },
  detallePorCodigo(codigo: string) {
    return internalApi.get<PlanoDTO>(`/api/planos/detalle?codigo=${encodeURIComponent(codigo)}`);
  },
  crear(body: { codigo: string; nombre: string; descripcion?: string | null; tipo?: TipoPlano }) {
    return internalApi.post<PlanoDTO>("/api/planos/crear", body);
  },
  actualizarMeta(body: { id: string; nombre?: string; descripcion?: string | null; flgActivo?: boolean; tipo?: TipoPlano; imagenFondo?: string | null }) {
    return internalApi.patch<PlanoDTO>("/api/planos/actualizar-meta", body);
  },
  guardarLayout(body: {
    id: string;
    tipos: Array<{ codigo: string; label: string; nombre: string; w: number; d: number; h: number; color: string }>;
    bloques: Array<{ bloqueId: string; tipoCodigo: string; x: number; z: number; rotY: number; orden: number; flgActivo: boolean }>;
    furniture: Array<{ refId: string; tipo: string; x: number; z: number; rotY: number; config?: unknown }>;
  }) {
    return internalApi.post<PlanoDTO>("/api/planos/guardar-layout", body);
  },
  eliminar(id: string) {
    return internalApi.post<{ ok: boolean }>("/api/planos/eliminar", { id });
  },
  exportar(id: string) {
    return internalApi.get<PlanoExportDTO>(`/api/planos/exportar?id=${encodeURIComponent(id)}`);
  },
  exportarTs(id: string) {
    return internalApi.get<PlanoTsExportDTO>(`/api/planos/exportar-ts?id=${encodeURIComponent(id)}`);
  },
  importar(body: PlanoExportDTO) {
    return internalApi.post<PlanoDTO>("/api/planos/importar", body);
  },
  guardarSecciones(body: { id: string; secciones: Array<Omit<PlanoSeccionDTO, "id">> }) {
    return internalApi.post<PlanoDTO>("/api/planos/guardar-secciones", body);
  },
  macrosDePlano(planoId: string) {
    return internalApi.get<Array<{ id: string; codigo: string; nombre: string }>>(`/api/planos/macros-de-plano?planoId=${encodeURIComponent(planoId)}`);
  },
  asignarAMacro(macroId: string, planoId: string) {
    return internalApi.post<PlanoDTO>("/api/planos/asignar-macro", { macroId, planoId });
  },
  quitarDeMacros(planoId: string) {
    return internalApi.post<{ ok: boolean }>("/api/planos/quitar-macro", { planoId });
  },
  ocupacion(id: string, eventoId: string) {
    return internalApi.get<SeccionOcupacionDTO[]>(`/api/planos/ocupacion?id=${encodeURIComponent(id)}&eventoId=${encodeURIComponent(eventoId)}`);
  },
  async subirImagen(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = (await res.json()) as { success?: boolean; data?: { url: string } };
    if (!json.success || !json.data?.url) throw new Error("Error al subir imagen");
    return json.data.url;
  },
};
