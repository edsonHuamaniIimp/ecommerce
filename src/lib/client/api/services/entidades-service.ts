import { internalApi } from "./internal-api";

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
};
