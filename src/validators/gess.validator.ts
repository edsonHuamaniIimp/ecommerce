import { z } from "zod";

export const updateGessStandSchema = z.object({
  id: z.string().min(1),
  bloqueId: z.string().nullable().optional(),
  documentos: z.array(z.string()).optional(),
  imagenes: z.array(z.string()).optional(),
  estado: z.string().optional(),
});

export type UpdateGessStandInput = z.infer<typeof updateGessStandSchema>;
