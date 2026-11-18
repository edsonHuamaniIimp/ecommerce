import { z } from "zod";
import { RECORDATORIOS_FACTURACION, TIPOS_COMPROBANTE } from "@/lib/shared/constants";

/** Cuerpo de POST `/api/facturacion/adjuntar-comprobante` (bandeja de Facturacion). */
export const adjuntarComprobanteFiscalSchema = z.object({
  cuotaId: z.string().min(1, "cuotaId requerido"),
  tipo: z.enum([TIPOS_COMPROBANTE.FACTURA, TIPOS_COMPROBANTE.BOLETA], {
    message: "Tipo de comprobante invalido",
  }),
  numero: z.string().trim().min(1, "numero requerido").max(30, "numero demasiado largo"),
  url: z.string().min(1, "url requerida").max(500),
});

/** Cuerpo de POST `/api/facturacion/recordatorios/enviar`. */
export const enviarRecordatoriosSchema = z.object({
  tipo: z.enum([RECORDATORIOS_FACTURACION.SIN_SOLICITUD, RECORDATORIOS_FACTURACION.DOCUMENTOS_PENDIENTES], {
    message: "Tipo de recordatorio invalido",
  }),
  facturacionIds: z
    .array(z.string().min(1))
    .min(1, "Selecciona al menos una empresa")
    .max(500, "Maximo 500 empresas por envio"),
});
