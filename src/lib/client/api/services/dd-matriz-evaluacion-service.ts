import "client-only";

import { internalApi } from "./internal-api";
import type { DdDocumentoTipo, DdMatrizResultadoFinal } from "@/lib/shared/constants";
import type {
  DdMatrizAutomatizacionDTO,
  DdVinculoObservadoRequestDTO,
  DdMatrizEvaluacionAdjuntoEliminarRequestDTO,
  DdMatrizEvaluacionAdjuntoResponseDTO,
  DdMatrizEvaluacionDetalleDTO,
  DdMatrizEvaluacionExportarRequestDTO,
  DdMatrizEvaluacionExportarResponseDTO,
  DdMatrizEvaluacionGuardarRequestDTO,
  DdMatrizEvaluacionQueryDTO,
  DdMatrizEvaluacionResumenDTO,
  DdMatrizEvaluacionResponseDTO,
  DdMatrizEvaluacionVinculoRequestDTO,
} from "@/types/dto/debida-diligencia";

const BASE = "/api/debida-diligencia/matriz-evaluacion";

/** Fachada cliente de la Matriz de evaluacion DD (por vinculo empresa/persona). */
export const ddMatrizEvaluacionService = {
  listar(params: DdMatrizEvaluacionQueryDTO = {}) {
    const qs = new URLSearchParams();
    if (params.eventoId) qs.set("eventoId", params.eventoId);
    if (params.expedienteId) qs.set("expedienteId", params.expedienteId);
    if (params.page) qs.set("page", String(params.page));
    if (params.perPage) qs.set("perPage", String(params.perPage));
    if (params.search) qs.set("search", params.search);
    if (params.tipo) qs.set("tipo", params.tipo);
    if (params.ambito) qs.set("ambito", params.ambito);
    if (params.pais) qs.set("pais", params.pais);
    if (params.fechaDesde) qs.set("fechaDesde", params.fechaDesde);
    if (params.fechaHasta) qs.set("fechaHasta", params.fechaHasta);
    if (params.sinPais) qs.set("sinPais", "true");
    if (params.resultadoFinal) qs.set("resultadoFinal", params.resultadoFinal);
    if (params.sinEvaluar) qs.set("sinEvaluar", "true");
    if (params.porEmpresa) qs.set("porEmpresa", "true");
    const sufijo = qs.toString() ? `?${qs.toString()}` : "";
    return internalApi.get<DdMatrizEvaluacionResponseDTO>(`${BASE}${sufijo}`);
  },

  /** Indicadores (stats) de toda la matriz del evento o de todos. */
  resumen(eventoId?: string) {
    const qs = eventoId ? `?eventoId=${encodeURIComponent(eventoId)}` : "";
    return internalApi.get<DdMatrizEvaluacionResumenDTO>(`${BASE}/resumen${qs}`);
  },

  /** Id de la fila de la empresa de un expediente (abre su detalle en la matriz). */
  abrir(expedienteId: string) {
    return internalApi.get<{ id: string }>(`${BASE}/abrir?expedienteId=${encodeURIComponent(expedienteId)}`);
  },

  detalle(id: string) {
    return internalApi.get<DdMatrizEvaluacionDetalleDTO>(`${BASE}/detalle?id=${encodeURIComponent(id)}`);
  },

  /** Datos completos para el Excel oficial: ids elegidos o los filtros de la lista. */
  exportar(body: DdMatrizEvaluacionExportarRequestDTO) {
    return internalApi.post<DdMatrizEvaluacionExportarResponseDTO>(`${BASE}/exportar`, body);
  },

  guardar(body: DdMatrizEvaluacionGuardarRequestDTO) {
    return internalApi.post<DdMatrizEvaluacionDetalleDTO>(`${BASE}/guardar`, body);
  },

  /**
   * Registra el resultado final del expediente (fila de la empresa) desde el modal de revision:
   * el mismo flujo en la Matriz, el detalle de vinculo y el Centro documental.
   */
  async registrarResultadoFinal(
    expedienteId: string,
    resultado: DdMatrizResultadoFinal,
    comentario?: string,
    cierre?: {
      clienteComentario?: string | null;
      documentosObservados?: DdDocumentoTipo[];
      vinculosObservados?: DdVinculoObservadoRequestDTO[];
    },
  ): Promise<void> {
    const { id } = await this.abrir(expedienteId);
    await this.guardar({
      id,
      resultadoFinal: resultado,
      finalComentario: comentario?.trim() || null,
      clienteComentario: cierre?.clienteComentario ?? null,
      documentosObservados: cierre?.documentosObservados ?? [],
      vinculosObservados: cierre?.vinculosObservados ?? [],
    });
  },

  agregarVinculo(body: DdMatrizEvaluacionVinculoRequestDTO) {
    return internalApi.post<DdMatrizEvaluacionDetalleDTO>(`${BASE}/vinculo`, body);
  },

  eliminarVinculo(id: string) {
    return internalApi.post<{ ok: boolean }>(`${BASE}/vinculo/eliminar`, { id });
  },

  automatizarTodo(vinculoId: string) {
    return internalApi.post<DdMatrizAutomatizacionDTO>(`${BASE}/automatizar-todo`, { vinculoId });
  },

  estadoAutomatizacion(jobId: string) {
    return internalApi.get<DdMatrizAutomatizacionDTO>(`${BASE}/automatizacion?jobId=${encodeURIComponent(jobId)}`);
  },

  automatizarEvidencia(vinculoId: string, codigo: string) {
    return internalApi.post<DdMatrizEvaluacionAdjuntoResponseDTO>(`${BASE}/automatizar`, { vinculoId, codigo });
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

