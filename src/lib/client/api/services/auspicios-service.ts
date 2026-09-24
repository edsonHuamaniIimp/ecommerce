import 'client-only';

import { internalApi } from "./internal-api";

export interface GrabarAuspicioBody {
  code: number;
  codeEvent: number;
  [key: string]: unknown;
}

export const auspiciosService = {
  /** Lista los auspicios del evento. El tipo de fila lo define el consumidor. */
  async listar<T>(code: number, codeEvent: number): Promise<T[]> {
    const data = await internalApi.post<{ auspicios?: T[] }>("/api/auspicios/listar", { code, codeEvent });
    return data?.auspicios ?? [];
  },
  grabar(body: GrabarAuspicioBody): Promise<unknown> {
    return internalApi.post<unknown>("/api/auspicios/grabar", body);
  },
};
