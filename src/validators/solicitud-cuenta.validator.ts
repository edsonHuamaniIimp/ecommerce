import { z } from "zod";
import { ESTADOS_SOLICITUD_CUENTA_REVISION, VALIDACIONES } from "@/lib/shared/constants";

const REGEX_RUC = new RegExp(`^\\d{${VALIDACIONES.RUC_LONGITUD}}$`);

export const crearSolicitudCuentaSchema = z.object({
  email: z.email("Correo electronico invalido").max(VALIDACIONES.EMAIL_MAX),
  nombre: z.string().trim().min(1, "nombre requerido").max(VALIDACIONES.NOMBRE_MAX),
  apellidos: z.string().trim().min(1, "apellidos requerido").max(VALIDACIONES.APELLIDOS_MAX),
  telefono: z
    .string()
    .trim()
    .min(VALIDACIONES.TELEFONO_MIN, "telefono invalido")
    .max(VALIDACIONES.TELEFONO_MAX)
    .optional(),
  razonSocial: z.string().trim().min(1, "razonSocial requerido").max(VALIDACIONES.RAZON_SOCIAL_MAX),
  ruc: z.string().trim().regex(REGEX_RUC, `El RUC debe tener ${VALIDACIONES.RUC_LONGITUD} digitos`).optional(),
  cargo: z.string().trim().max(VALIDACIONES.CARGO_MAX).optional(),
  mensaje: z.string().trim().max(VALIDACIONES.MENSAJE_MAX).optional(),
});

export const revisarSolicitudCuentaSchema = z.object({
  id: z.string().min(1, "id requerido"),
  estado: z.enum(ESTADOS_SOLICITUD_CUENTA_REVISION),
  motivoRechazo: z.string().trim().max(VALIDACIONES.MENSAJE_MAX).optional(),
});

export type CrearSolicitudCuentaInput = z.infer<typeof crearSolicitudCuentaSchema>;
export type RevisarSolicitudCuentaInput = z.infer<typeof revisarSolicitudCuentaSchema>;
