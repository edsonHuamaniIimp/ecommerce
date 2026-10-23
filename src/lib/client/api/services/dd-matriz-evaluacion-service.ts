import "client-only";

import { internalApi } from "./internal-api";
import type {
  DdMatrizEvaluacionAdjuntoEliminarRequestDTO,
  DdMatrizEvaluacionAdjuntoResponseDTO,
  DdMatrizEvaluacionDetalleDTO,
  DdMatrizEvaluacionGuardarRequestDTO,
  DdMatrizEvaluacionQueryDTO,
  DdMatrizEvaluacionResponseDTO,
  DdMatrizEvaluacionVinculoRequestDTO,
} from "@/types/dto/debida-diligencia";

const BASE = "/api/debida-diligencia/matriz-evaluacion";

/** Fachada cliente de la Matriz de evaluacion DD (por vinculo empresa/persona). */
export const ddMatrizEvaluacionService = {
  listar(params: DdMatrizEvaluacionQueryDTO = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.perPage) qs.set("perPage", String(params.perPage));
    if (params.search) qs.set("search", params.search);
    if (params.tipo) qs.set("tipo", params.tipo);
    if (params.ambito) qs.set("ambito", params.ambito);
    if (params.pais) qs.set("pais", params.pais);
    if (params.sinPais) qs.set("sinPais", "true");
    if (params.resultadoFinal) qs.set("resultadoFinal", params.resultadoFinal);
    if (params.sinEvaluar) qs.set("sinEvaluar", "true");
    const sufijo = qs.toString() ? `?${qs.toString()}` : "";
    return internalApi.get<DdMatrizEvaluacionResponseDTO>(`${BASE}${sufijo}`);
  },

  /** Id de la fila de la empresa de un expediente (abre su detalle en la matriz). */
  abrir(expedienteId: string) {
    return internalApi.get<{ id: string }>(`${BASE}/abrir?expedienteId=${encodeURIComponent(expedienteId)}`);
  },

  detalle(id: string) {
    return internalApi.get<DdMatrizEvaluacionDetalleDTO>(`${BASE}/detalle?id=${encodeURIComponent(id)}`);
  },

  guardar(body: DdMatrizEvaluacionGuardarRequestDTO) {
    return internalApi.post<DdMatrizEvaluacionDetalleDTO>(`${BASE}/guardar`, body);
  },

  agregarVinculo(body: DdMatrizEvaluacionVinculoRequestDTO) {
    return internalApi.post<DdMatrizEvaluacionDetalleDTO>(`${BASE}/vinculo`, body);
  },

  eliminarVinculo(id: string) {
    return internalApi.post<{ ok: boolean }>(`${BASE}/vinculo/eliminar`, { id });
  },

  subirAdjunto(vinculoId: string, categoria: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("vinculoId", vinculoId);
    formData.append("categoria", categoria);
    return internalApi.postForm<DdMatrizEvaluacionAdjuntoResponseDTO>(`${BASE}/adjunto`, formData);
  },

  eliminarAdjunto(body: DdMatrizEvaluacionAdjuntoEliminarRequestDTO) {
    return internalApi.post<{ ok: boolean }>(`${BASE}/adjunto/eliminar`, body);
  },
};
