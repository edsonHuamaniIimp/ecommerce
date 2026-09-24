import 'client-only';

import { internalApi } from "./internal-api";

export const facturacionService = {
  /** Datos de sesion Niubiz para pagar una cuota. */
  sesionNiubizz(facturacionId: string) {
    return internalApi.post<Record<string, unknown>>("/api/facturacion/niubizz/sesion", { facturacionId });
  },
};
