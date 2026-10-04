import { z } from "zod";
import { MODOS_NOTIFICACION, REVISION_AREAS, RESULTADOS_APROBACION } from "@/lib/shared/constants";

export const solicitudesListarSchema = z.object({
  eventoId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().optional(),
});

export const solicitudesDetalleSchema = z.object({
  id: z.string().uuid(),
});

export const solicitudesRevisarSchema = z.object({
  solicitudId: z.string().uuid(),
  area: z.enum(Object.values(REVISION_AREAS) as [string, ...string[]]),
  estado: z.enum(Object.values(RESULTADOS_APROBACION) as [string, ...string[]]),
  comentario: z.string().max(2000).optional(),
});

/** Notificacion manual del resultado al cliente desde la bandeja. */
export const solicitudesNotificarSchema = z.object({
  solicitudId: z.string().uuid(),
  to: z.string().trim().email("Correo invalido"),
  modo: z.enum([MODOS_NOTIFICACION.AUTOMATICO, MODOS_NOTIFICACION.PERSONALIZADO]),
  mensaje: z.string().max(5000).optional(),
});

/** Documento adjunto de una solicitud (contrato, firmado o anexo con requisito RF-13). */
export const uploadDocumentoSchema = z.object({
  solicitudId: z.string().min(1, "solicitudId requerido"),
  url: z.string().min(1, "url requerida").max(500),
  nombre: z.string().trim().max(200).optional(),
  tipo: z.string().max(30).optional(),
  requisito: z.string().max(30).optional().nullable(),
});

/** RF-08: imagen del recorte del pabellon (se guarda tras subirla a /api/upload). */
export const solicitudesRecortePlanoSchema = z.object({
  solicitudId: z.string().uuid(),
  url: z.string().min(1, "url requerida").max(500),
});
