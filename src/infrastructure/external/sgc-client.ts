import type { ISgcClient } from "@/domain/ports/sgc-client";
import { SgcApiError } from "@/domain/models/sgc";
import type {
  SgcActualizarExpedienteInput,
  SgcConfirmarSubidaResult,
  SgcCrearExpedienteInput,
  SgcCrearExpedienteResult,
  SgcDocumentoDetalle,
  SgcExpedienteDetalle,
  SgcListarFiltros,
  SgcPaginaExpedientes,
  SgcReservarSubidaInput,
  SgcReservarSubidaResult,
  SgcUrlDescarga,
  SgcVersionResuelta,
} from "@/domain/models/sgc";
import { HTTP_METHODS, SGC_API_PATHS, SGC_APPROVAL_RESULT } from "@/lib/shared/constants";
import type { HttpMethod } from "@/lib/shared/constants";

export interface SgcClientConfig {
  apiUrl: string;
  apiKey: string;
  timeoutMs: number;
}

/**
 * Adaptador HTTP real del SGC (`/api/integrations/v1`). Autentica con
 * `Authorization: Bearer sgc_<clave>`; usa `Idempotency-Key` en la creacion de
 * expediente y timeout por AbortController. Los binarios NO viajan por estos
 * endpoints: se suben al `uploadUrl` prefirmado (PUT) y se descargan por enlace
 * de vida corta.
 */
export class SgcClient implements ISgcClient {
  constructor(private readonly cfg: SgcClientConfig) {}

  private url(path: string): string {
    return `${this.cfg.apiUrl.replace(/\/$/, "")}${path}`;
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    opciones?: { body?: unknown; idempotencyKey?: string; raw?: Uint8Array; headers?: Record<string, string> },
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.cfg.apiKey}`,
        ...(opciones?.idempotencyKey ? { "Idempotency-Key": opciones.idempotencyKey } : {}),
        ...opciones?.headers,
      };
      let body: BodyInit | undefined;
      if (opciones?.raw !== undefined) body = opciones.raw as unknown as BodyInit;
      else if (opciones?.body !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(opciones.body);
      }

      const res = await fetch(this.url(path), { method, headers, body, cache: "no-store", signal: controller.signal });
      if (!res.ok) {
        const detalle = await res.text().catch(() => "");
        throw new SgcApiError(`SGC ${res.status}: ${detalle.slice(0, 300) || res.statusText}`, res.status);
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  crearExpediente(input: SgcCrearExpedienteInput, idempotencyKey: string): Promise<SgcCrearExpedienteResult> {
    return this.request<SgcCrearExpedienteResult>(HTTP_METHODS.POST, SGC_API_PATHS.CONTRACTS, { body: input, idempotencyKey });
  }

  async actualizarExpediente(contractId: string, input: SgcActualizarExpedienteInput): Promise<void> {
    await this.request<void>(HTTP_METHODS.PATCH, SGC_API_PATHS.CONTRACT(contractId), { body: input });
  }

  consultarExpediente(contractId: string): Promise<SgcExpedienteDetalle> {
    return this.request<SgcExpedienteDetalle>(HTTP_METHODS.GET, SGC_API_PATHS.CONTRACT(contractId));
  }

  async listarExpedientes(filtros: SgcListarFiltros): Promise<SgcPaginaExpedientes> {
    const qs = new URLSearchParams();
    if (filtros.q) qs.set("q", filtros.q);
    if (filtros.stage) qs.set("stage", filtros.stage);
    if (filtros.page) qs.set("page", String(filtros.page));
    if (filtros.pageSize) qs.set("pageSize", String(filtros.pageSize));
    const sufijo = qs.size > 0 ? `?${qs.toString()}` : "";
    const data = await this.request<unknown>(HTTP_METHODS.GET, `${SGC_API_PATHS.CONTRACTS}${sufijo}`);
    return normalizarPagina(data);
  }

  reservarSubida(contractId: string, input: SgcReservarSubidaInput): Promise<SgcReservarSubidaResult> {
    return this.request<SgcReservarSubidaResult>(HTTP_METHODS.POST, SGC_API_PATHS.CONTRACT_DOCUMENTS(contractId), {
      body: input,
    });
  }

  async transferirArchivo(uploadUrl: string, headers: Record<string, string>, binario: Uint8Array): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const res = await fetch(uploadUrl, {
        method: HTTP_METHODS.PUT,
        headers,
        body: binario as unknown as BodyInit,
        signal: controller.signal,
      });
      if (!res.ok) throw new SgcApiError(`Subida rechazada por el almacenamiento: ${res.status}`, res.status);
    } finally {
      clearTimeout(timer);
    }
  }

  async confirmarSubida(versionId: string): Promise<SgcConfirmarSubidaResult> {
    const res = await fetch(this.url(SGC_API_PATHS.DOCUMENT_VERSION_COMPLETE(versionId)), {
      method: HTTP_METHODS.POST,
      headers: { Authorization: `Bearer ${this.cfg.apiKey}` },
      cache: "no-store",
    });
    if (res.status === 422) {
      const cuerpo = (await res.json().catch(() => ({}))) as { outcome?: string; message?: string };
      return { outcome: SGC_APPROVAL_RESULT.REJECTED, message: cuerpo.message };
    }
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      throw new SgcApiError(`SGC ${res.status}: ${detalle.slice(0, 300) || res.statusText}`, res.status);
    }
    return (await res.json()) as SgcConfirmarSubidaResult;
  }

  consultarDocumento(documentId: string): Promise<SgcDocumentoDetalle> {
    return this.request<SgcDocumentoDetalle>(HTTP_METHODS.GET, SGC_API_PATHS.DOCUMENT(documentId));
  }

  resolverVersion(versionId: string): Promise<SgcVersionResuelta> {
    return this.request<SgcVersionResuelta>(HTTP_METHODS.GET, SGC_API_PATHS.DOCUMENT_VERSION(versionId));
  }

  obtenerUrlDescarga(versionId: string): Promise<SgcUrlDescarga> {
    return this.request<SgcUrlDescarga>(HTTP_METHODS.GET, SGC_API_PATHS.DOCUMENT_VERSION_DOWNLOAD(versionId));
  }
}

function normalizarPagina(data: unknown): SgcPaginaExpedientes {
  if (Array.isArray(data)) {
    return { items: data as SgcPaginaExpedientes["items"], page: 1, pageSize: data.length, total: data.length };
  }
  const obj = (data ?? {}) as Partial<SgcPaginaExpedientes>;
  const items = obj.items ?? [];
  return { items, page: obj.page ?? 1, pageSize: obj.pageSize ?? items.length, total: obj.total ?? items.length };
}
