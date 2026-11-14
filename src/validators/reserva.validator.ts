import { z } from "zod";
import { MAX_RESERVA_ADMIN_STANDS, MONEDAS, TIPOS_COMPROBANTE } from "@/lib/shared/constants";

export const reservaRequestSchema = z.object({
  standIds: z.array(z.string()).min(1),
  /** Moneda elegida para la solicitud/contrato. */
  moneda: z.enum([MONEDAS.USD, MONEDAS.PEN]).optional(),
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

/** Reserva administrativa a nombre de una empresa (pabellones internacionales). */
export const reservaAdminSchema = z.object({
  eventoId: z.string().uuid(),
  empresaRuc: z.string().min(1).max(20),
  standIds: z.array(z.string()).min(1).max(MAX_RESERVA_ADMIN_STANDS),
  moneda: z.enum([MONEDAS.USD, MONEDAS.PEN]).optional(),
  tipoComprobante: z.enum([TIPOS_COMPROBANTE.FACTURA, TIPOS_COMPROBANTE.BOLETA]).optional(),
  cuotas: z.array(z.object({
    porcentaje: z.number().min(0).max(100),
    fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })).min(1).max(9),
});

export type ReservaAdminInput = z.infer<typeof reservaAdminSchema>;
