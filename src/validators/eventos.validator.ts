import { z } from "zod";
import { TIPO_CAMBIO_MAX } from "@/lib/shared/utils/moneda";

export const createEventoSchema = z.object({
  evento_padre_id: z.string().min(1, "evento_padre_id requerido"),
  anio: z.string().min(1, "anio requerido"),
  fecha_inicio: z.string().optional(),
  fecha_fin: z.string().optional(),
});

const modalInfoItemSchema = z.object({
  titulo: z.string(),
  descripcion: z.string(),
});

const modalInfoAyudaSchema = z.object({
  titulo: z.string(),
  descripcion: z.string(),
  texto_boton: z.string(),
  url: z.string(),
});

export const modalInfoSchema = z.object({
  activo: z.boolean(),
  titulo: z.string().min(1, "titulo requerido"),
  subtitulo: z.string().nullable().optional(),
  items: z.array(modalInfoItemSchema),
  ayuda: modalInfoAyudaSchema.nullable().optional(),
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
  modal_info: modalInfoSchema.nullable().optional(),
  tipo_cambio: z.number().positive().max(TIPO_CAMBIO_MAX).nullable().optional(),
});

export type CreateEventoInput = z.infer<typeof createEventoSchema>;
export type UpdateEventoInput = z.infer<typeof updateEventoSchema>;
