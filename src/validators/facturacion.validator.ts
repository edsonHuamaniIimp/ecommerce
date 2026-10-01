import { z } from "zod";
import { TIPOS_COMPROBANTE } from "@/lib/shared/constants";

/** Cuerpo de POST `/api/facturacion/adjuntar-comprobante` (bandeja de Facturacion). */
export const adjuntarComprobanteFiscalSchema = z.object({
  cuotaId: z.string().min(1, "cuotaId requerido"),
  tipo: z.enum([TIPOS_COMPROBANTE.FACTURA, TIPOS_COMPROBANTE.BOLETA], {
    message: "Tipo de comprobante invalido",
  }),
  numero: z.string().trim().min(1, "numero requerido").max(30, "numero demasiado largo"),
  url: z.string().min(1, "url requerida").max(500),
});
