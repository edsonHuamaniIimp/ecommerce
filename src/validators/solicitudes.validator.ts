import { z } from "zod";
import { ESTADOS_SOLICITUD, MODOS_NOTIFICACION, REVISION_AREAS, RESULTADOS_APROBACION, SOLICITUDES_FILTRO_SGC, SOLICITUDES_ORDEN } from "@/lib/shared/constants";

export const solicitudesListarSchema = z.object({
  eventoId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  /* 500 permite la exportacion completa (CSV/Excel) en pocas llamadas. */
  per_page: z.coerce.number().int().min(1).max(500).default(10),
  search: z.string().max(200).optional(),
  estado: z.enum(Object.values(ESTADOS_SOLICITUD) as [string, ...string[]]).optional(),
  empresa: z.string().max(200).optional(),
  standCode: z.string().max(50).optional(),
  areaPendiente: z.enum(Object.values(REVISION_AREAS) as [string, ...string[]]).optional(),
  sgc: z.enum(Object.values(SOLICITUDES_FILTRO_SGC) as [string, ...string[]]).optional(),
  docsObservados: z.enum(["true", "false"]).optional(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  orden: z.enum(Object.values(SOLICITUDES_ORDEN) as [string, ...string[]]).default(SOLICITUDES_ORDEN.RECIENTES),
});

export const solicitudesDetalleSchema = z.object({
  id: z.string().uuid(),
});

export const solicitudesRevisarSchema = z.object({
  solicitudId: z.string().uuid(),
  area: z.enum(Object.values(REVISION_AREAS) as [string, ...string[]]),
  estado: z.enum(Object.values(RESULTADOS_APROBACION) as [string, ...string[]]),
  comentario: z.string().max(2000).optional(),
  /** Documentos (IDs) observados por el Asociado; obligatorio si estado = observado. */
  documentosObservados: z.array(z.string().uuid()).max(50).optional(),
});

/** Reenvio del cliente tras una observacion local (Asociado). */
export const solicitudesReenviarObservacionSchema = z.object({
  solicitudId: z.string().uuid(),
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
