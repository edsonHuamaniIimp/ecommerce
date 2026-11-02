import { z } from "zod";
import {
  MAX_CONTACTOS_FACTURACION,
  MAX_STANDS_RESERVA_DEFAULT,
  MAX_STANDS_RESERVA_LIMITE,
  MAX_STANDS_RESERVA_MIN,
  REGEX_EMAIL,
} from "@/lib/shared/constants";

const emailOpcional = z
  .union([z.literal(""), z.string().trim().regex(REGEX_EMAIL, "Correo invalido").max(200)])
  .optional()
  .nullable();

/** Lista de correos de contacto de facturacion (puede ser vacia). */
const correosFacturacion = z
  .array(z.string().trim().regex(REGEX_EMAIL, "Correo invalido").max(200))
  .max(MAX_CONTACTOS_FACTURACION)
  .optional()
  .default([]);

/** Lista de telefonos de contacto de facturacion (puede ser vacia). */
const telefonosFacturacion = z
  .array(z.string().trim().min(6, "Telefono invalido").max(30))
  .max(MAX_CONTACTOS_FACTURACION)
  .optional()
  .default([]);

const urlOpcional = z
  .union([z.literal(""), z.string().trim().regex(/^https?:\/\/.+/i, "URL invalida (debe iniciar con http:// o https://)").max(500)])
  .optional()
  .nullable();

/** Guardado de la configuracion publica del portal (login/presala). */
export const actualizarPortalConfigSchema = z.object({
  mesaAyudaEmail: emailOpcional,
  contactoEmail: emailOpcional,
  facturacionEmails: correosFacturacion,
  facturacionTelefonos: telefonosFacturacion,
  manualUrl: urlOpcional,
  reglamentoUrl: urlOpcional,
  /** Duracion del bloqueo temporal al abrir el wizard de reserva. */
  holdReservaMinutos: z.number().int().min(1).max(120).default(25),
  /** Maximo de stands por solicitud de reserva. */
  maxStandsReserva: z.number().int().min(MAX_STANDS_RESERVA_MIN).max(MAX_STANDS_RESERVA_LIMITE).default(MAX_STANDS_RESERVA_DEFAULT),
  /** Aviso global de mantenimiento y ventana de vigencia. */
  mantenimientoActivo: z.boolean().optional().default(false),
  mantenimientoInicio: z.union([z.literal(""), z.string().datetime()]).nullable().optional(),
  mantenimientoFin: z.union([z.literal(""), z.string().datetime()]).nullable().optional(),
  mantenimientoPermiteCerrar: z.boolean().optional().default(false),
});

export type ActualizarPortalConfigInput = z.infer<typeof actualizarPortalConfigSchema>;
