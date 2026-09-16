import { z } from "zod";
import { REVISION_AREAS, RESULTADOS_APROBACION } from "@/lib/shared/constants";

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
