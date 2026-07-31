import { z } from "zod";

export const reservaRequestSchema = z.object({
  standIds: z.array(z.string()).min(1),
  documentos: z.array(z.string()).optional(),
  datos: z.object({
    razonSocial: z.string(),
    tipoDocumento: z.string(),
    numeroDocumento: z.string(),
    email: z.string().email(),
  }).optional(),
});

export type ReservaRequestInput = z.infer<typeof reservaRequestSchema>;
