import 'client-only';

import { internalApi } from "./internal-api";

interface RucResponse {
  razonSocial?: string;
  nombre?: string;
  error?: string;
}

interface DniResponse {
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  nombreCompleto?: string;
  error?: string;
}

export const sunatService = {
  async consultarRuc(ruc: string): Promise<RucResponse> {
    try {
      const data = await internalApi.get<Record<string, unknown>>(`/api/sunat/ruc?numero=${encodeURIComponent(ruc)}`);
      return data as unknown as RucResponse;
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error" };
    }
  },

  async consultarDni(dni: string): Promise<DniResponse> {
    try {
      const data = await internalApi.get<Record<string, unknown>>(`/api/reniec/dni?numero=${encodeURIComponent(dni)}`);
      return data as unknown as DniResponse;
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error" };
    }
  },
};
