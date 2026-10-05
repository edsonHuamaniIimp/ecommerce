import { internalApi } from "./internal-api";

/** Empresa normalizada de la API de entidades (codigo SIE + razon social + RUC). */
export interface EmpresaEntidadDTO {
  idEmpresa: string;
  razonSocial: string;
  documento: string;
}

function normalizarEmpresas(lista: Record<string, unknown>[] | undefined): EmpresaEntidadDTO[] {
  return (lista ?? [])
    .map((e) => ({
      idEmpresa: String(e.ecicod ?? e.id_empresa ?? e.sie_code ?? ""),
      razonSocial: String(e.razonSocial ?? e.empresa ?? ""),
      documento: String(e.numDocumento ?? e.documento ?? ""),
    }))
    .filter((e) => e.idEmpresa || e.razonSocial);
}

export const entidadesService = {
  searchPerson(documento?: string, nombre?: string) {
    return internalApi.post<{ success: boolean; message: string; ListInfoPersona: Record<string, unknown>[] }>(
      "/api/entidades/persona",
      { documento: documento || "", nombre: nombre || "" },
    );
  },

  searchEmpresa(nroDocument?: string, razonSocial?: string) {
    return internalApi.post<{ success: boolean; message: string; ListInfoEmpresa: Record<string, unknown>[] }>(
      "/api/entidades/empresa",
      { nroDocument: nroDocument || "", razonSocial: razonSocial || "" },
    );
  },

  /** Busca empresas por RUC (si el termino es numerico) o por razon social, normalizado. */
  async buscarEmpresas(q: string): Promise<EmpresaEntidadDTO[]> {
    const termino = q.trim();
    const esDocumento = /^\d+$/.test(termino);
    const data = esDocumento
      ? await this.searchEmpresa(termino, undefined)
      : await this.searchEmpresa(undefined, termino);
    const lista = data.ListInfoEmpresa
      ?? (data as unknown as Record<string, unknown>).ListEmpresa as Record<string, unknown>[] | undefined;
    return normalizarEmpresas(lista);
  },
};
