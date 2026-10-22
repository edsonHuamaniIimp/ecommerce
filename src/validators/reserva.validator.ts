import { z } from "zod";

export const reservaRequestSchema = z.object({
  standIds: z.array(z.string()).min(1),
  /** Hold creado al abrir el wizard. */
  holdId: z.string().uuid().optional(),
  documentos: z.array(z.string()).optional(),
  cuotas: z.array(z.object({
    porcentaje: z.number().min(0).max(100),
    fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })).min(1).max(9).optional(),
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
