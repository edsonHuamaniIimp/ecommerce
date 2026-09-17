import 'client-only';

import { internalApi } from "./internal-api";

interface RucResponse {
  razonSocial?: string;
  nombre?: string;
  direccion?: string;
  error?: string;
}

interface DniResponse {
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  nombreCompleto?: string;
  direccion?: string;
  error?: string;
}

function texto(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function aRucResponse(data: Record<string, unknown>): RucResponse {
  return {
    razonSocial: texto(data.razonSocial),
    nombre: texto(data.nombre),
    direccion: texto(data.direccion),
    error: texto(data.error),
  };
}

function aDniResponse(data: Record<string, unknown>): DniResponse {
  return {
    nombres: texto(data.nombres),
    apellidoPaterno: texto(data.apellidoPaterno),
    apellidoMaterno: texto(data.apellidoMaterno),
    nombreCompleto: texto(data.nombreCompleto),
    direccion: texto(data.direccion),
    error: texto(data.error),
  };
}

export const sunatService = {
  async consultarRuc(ruc: string): Promise<RucResponse> {
    try {
      const data = await internalApi.get<Record<string, unknown>>(`/api/sunat/ruc?numero=${encodeURIComponent(ruc)}`);
      return aRucResponse(data);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error" };
    }
  },

  async consultarDni(dni: string): Promise<DniResponse> {
    try {
      const data = await internalApi.get<Record<string, unknown>>(`/api/reniec/dni?numero=${encodeURIComponent(dni)}`);
      return aDniResponse(data);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error" };
    }
  },
};
