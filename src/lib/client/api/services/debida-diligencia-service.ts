import "client-only";

import { internalApi } from "./internal-api";
import type {
  DdBandejaQueryDTO,
  DdBandejaResponseDTO,
  DdDocumentoUploadResponseDTO,
  DdEmpresasImportResponseDTO,
  DdEmpresasResponseDTO,
  DdExpedienteDTO,
  DdGuardarRequestDTO,
  DdInformeLegalUploadResponseDTO,
  DdLegalResolverRequestDTO,
  DdMatrizQueryDTO,
  DdMatrizResponseDTO,
  DdMiExpedienteDTO,
  DdPanelDTO,
  DdReputacionQueryDTO,
  DdReputacionResponseDTO,
  DdReputacionResolverRequestDTO,
  DdRevisarRequestDTO,
} from "@/types/dto/debida-diligencia";

/** Fachada cliente del modulo Debida Diligencia (reglas y endpoints propios). */
export const debidaDiligenciaService = {
  miExpediente() {
    return internalApi.get<DdMiExpedienteDTO>("/api/debida-diligencia/mi-expediente");
  },

  guardar(body: DdGuardarRequestDTO) {
    return internalApi.post<DdExpedienteDTO>("/api/debida-diligencia/guardar", body);
  },

  enviar() {
    return internalApi.post<DdExpedienteDTO>("/api/debida-diligencia/enviar", {});
  },

  subirDocumento(tipo: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("tipo", tipo);
    return internalApi.postForm<DdDocumentoUploadResponseDTO>("/api/debida-diligencia/documento", formData);
  },

  detalle(id: string) {
    return internalApi.get<DdExpedienteDTO>(
      `/api/debida-diligencia/detalle?id=${encodeURIComponent(id)}`,
    );
  },

  importarEmpresas(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return internalApi.postForm<DdEmpresasImportResponseDTO>(
      "/api/debida-diligencia/empresas/importar",
      formData,
    );
  },

  empresas(params: { page?: number; perPage?: number; search?: string; resultado?: string; estadoEvaluacion?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.perPage) qs.set("perPage", String(params.perPage));
    if (params.search) qs.set("search", params.search);
    if (params.resultado) qs.set("resultado", params.resultado);
    if (params.estadoEvaluacion) qs.set("estadoEvaluacion", params.estadoEvaluacion);
    const sufijo = qs.toString() ? `?${qs.toString()}` : "";
    return internalApi.get<DdEmpresasResponseDTO>(`/api/debida-diligencia/empresas${sufijo}`);
  },

  /** Todas las empresas del registro externo, recorriendo su paginacion. */
  async empresasTodas(params: { search?: string; resultado?: string; estadoEvaluacion?: string } = {}) {
    const perPage = 100;
    const items: DdEmpresasResponseDTO["items"] = [];
    let page = 1;
    while (true) {
      const respuesta = await this.empresas({ ...params, page, perPage });
      items.push(...respuesta.items);
      if (page >= respuesta.pagination.totalPages) break;
      page += 1;
    }
    return items;
  },

  bandeja(params: DdBandejaQueryDTO = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.perPage) qs.set("perPage", String(params.perPage));
    if (params.search) qs.set("search", params.search);
    if (params.estado) qs.set("estado", params.estado);
    if (params.origen) qs.set("origen", params.origen);
    if (params.vinculo) qs.set("vinculo", params.vinculo);
    if (params.documentos) qs.set("documentos", params.documentos);
    const sufijo = qs.toString() ? `?${qs.toString()}` : "";
    return internalApi.get<DdBandejaResponseDTO>(`/api/debida-diligencia/bandeja${sufijo}`);
  },

  revisar(body: DdRevisarRequestDTO) {
    return internalApi.post<DdExpedienteDTO>("/api/debida-diligencia/revisar", body);
  },

  bandejaLegal(params: DdBandejaQueryDTO = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.perPage) qs.set("perPage", String(params.perPage));
    if (params.search) qs.set("search", params.search);
    const sufijo = qs.toString() ? `?${qs.toString()}` : "";
    return internalApi.get<DdBandejaResponseDTO>(`/api/debida-diligencia/legal/bandeja${sufijo}`);
  },

  resolverLegal(body: DdLegalResolverRequestDTO) {
    return internalApi.post<DdExpedienteDTO>("/api/debida-diligencia/legal/resolver", body);
  },

  subirInformeLegal(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return internalApi.postForm<DdInformeLegalUploadResponseDTO>(
      "/api/debida-diligencia/legal/informe",
      formData,
    );
  },

  panel() {
    return internalApi.get<DdPanelDTO>("/api/debida-diligencia/panel");
  },

  matriz(params: DdMatrizQueryDTO = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.perPage) qs.set("perPage", String(params.perPage));
    if (params.search) qs.set("search", params.search);
    if (params.estado) qs.set("estado", params.estado);
    if (params.vinculo) qs.set("vinculo", params.vinculo);
    const sufijo = qs.toString() ? `?${qs.toString()}` : "";
    return internalApi.get<DdMatrizResponseDTO>(`/api/debida-diligencia/matriz${sufijo}`);
  },

  reputacionListar(params: DdReputacionQueryDTO = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.perPage) qs.set("perPage", String(params.perPage));
    if (params.search) qs.set("search", params.search);
    if (params.estado) qs.set("estado", params.estado);
    const sufijo = qs.toString() ? `?${qs.toString()}` : "";
    return internalApi.get<DdReputacionResponseDTO>(`/api/debida-diligencia/reputacion/listar${sufijo}`);
  },

  reputacionResolver(body: DdReputacionResolverRequestDTO) {
    return internalApi.post<{ ok: boolean }>("/api/debida-diligencia/reputacion/resolver", body);
  },
};
