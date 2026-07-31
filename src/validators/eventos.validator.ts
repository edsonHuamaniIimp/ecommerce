import { z } from "zod";

export const createEventoSchema = z.object({
  evento_padre_id: z.string().min(1, "evento_padre_id requerido"),
  anio: z.string().min(1, "anio requerido"),
  fecha_inicio: z.string().optional(),
  fecha_fin: z.string().optional(),
});

export const updateEventoSchema = z.object({
  id: z.string().optional(),
  tipo_evento: z.number().optional(),
  codigo_evento: z.number().optional(),
  estado: z.string().optional(),
  anio: z.string().optional(),
  fecha_inicio: z.string().nullable().optional(),
  fecha_fin: z.string().nullable().optional(),
  flg_activo: z.boolean().optional(),
  flg_visible: z.boolean().optional(),
  plano: z.string().optional(),
  imagen: z.string().optional(),
});

export type CreateEventoInput = z.infer<typeof createEventoSchema>;
export type UpdateEventoInput = z.infer<typeof updateEventoSchema>;
