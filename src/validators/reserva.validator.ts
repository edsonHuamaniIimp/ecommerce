import { z } from "zod";

export const reservaRequestSchema = z.object({
  standIds: z.array(z.string()).min(1),
  documentos: z.array(z.string()).optional(),
  datos: z.object({
    razonSocial: z.string(),
    tipoDocumento: z.string(),
    numeroDocumento: z.string(),
    email: z.string().email(),
    tipoComprobante: z.string().max(20).optional(),
    direccion: z.string().max(200).optional(),
    telefono: z.string().max(20).optional(),
    contacto: z.string().max(150).optional(),
  }).optional(),
});

export type ReservaRequestInput = z.infer<typeof reservaRequestSchema>;
