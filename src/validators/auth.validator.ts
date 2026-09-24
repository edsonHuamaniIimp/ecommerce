import { z } from "zod";
import { REGISTRO_CODIGO, VALIDACIONES } from "@/lib/shared/constants";

const REGEX_RUC = new RegExp(`^\\d{${VALIDACIONES.RUC_LONGITUD}}$`);
const REGEX_CODIGO = new RegExp(`^\\d{${REGISTRO_CODIGO.LONGITUD}}$`);

export const registroSchema = z.object({
  email: z.email("Correo electronico invalido").max(VALIDACIONES.EMAIL_MAX),
  password: z
    .string()
    .min(VALIDACIONES.PASSWORD_MIN, `La contrasena debe tener al menos ${VALIDACIONES.PASSWORD_MIN} caracteres`)
    .max(VALIDACIONES.PASSWORD_MAX),
  nombre: z.string().trim().min(1, "nombre requerido").max(VALIDACIONES.NOMBRE_MAX),
  apellidos: z.string().trim().min(1, "apellidos requerido").max(VALIDACIONES.APELLIDOS_MAX),
  razonSocial: z.string().trim().min(1, "razonSocial requerido").max(VALIDACIONES.RAZON_SOCIAL_MAX),
  ruc: z.string().trim().regex(REGEX_RUC, `El RUC debe tener ${VALIDACIONES.RUC_LONGITUD} digitos`),
  telefono: z
    .string()
    .trim()
    .min(VALIDACIONES.TELEFONO_MIN, "telefono invalido")
    .max(VALIDACIONES.TELEFONO_MAX)
    .optional(),
});

export const registroConfirmarSchema = z.object({
  email: z.email("Correo electronico invalido").max(VALIDACIONES.EMAIL_MAX),
  codigo: z.string().trim().regex(REGEX_CODIGO, `El codigo debe tener ${REGISTRO_CODIGO.LONGITUD} digitos`),
});

export type RegistroInput = z.infer<typeof registroSchema>;
export type RegistroConfirmarInput = z.infer<typeof registroConfirmarSchema>;
