import { z } from "zod";
import { REGEX_EMAIL, TIPOS_DOCUMENTO_PERSONA } from "@/lib/shared/constants";

/**
 * Datos de la persona a buscar/crear en servicio-persona + correo del acceso local.
 * Documento y tipo van siempre juntos (regla de la fuente).
 */
const usuarioBaseSchema = z.object({
  email: z.string().regex(REGEX_EMAIL, "Correo invalido"),
  tipoDocumento: z.enum([
    TIPOS_DOCUMENTO_PERSONA.DNI,
    TIPOS_DOCUMENTO_PERSONA.CARNE_EXTRANJERIA,
    TIPOS_DOCUMENTO_PERSONA.PASAPORTE,
  ]),
  documento: z.string().min(1, "documento requerido").max(15),
  apellidoPaterno: z.string().min(1, "apellido paterno requerido").max(30),
  apellidoMaterno: z.string().max(30).nullish(),
  nombres: z.string().min(1, "nombres requeridos").max(30),
  celular: z.string().max(35).nullish(),
  direccion: z.string().max(100).nullish(),
  /** Rol local a asignar; por defecto cliente. */
  rolId: z.string().min(1).nullish(),
});

/** Empresa elegida desde la API de entidades (codigo SIE + razon social). */
const empresaAccesoSchema = z.object({
  idEmpresa: z.string().min(1, "idEmpresa requerido"),
  nombreEmpresa: z.string().min(1, "nombreEmpresa requerido").max(200),
  ruc: z.string().max(20).nullish(),
});

export const crearUsuarioSchema = usuarioBaseSchema.extend(empresaAccesoSchema.shape);

export const crearUsuariosLoteSchema = z.object({
  ...empresaAccesoSchema.shape,
  rolId: z.string().min(1).nullish(),
  usuarios: z.array(usuarioBaseSchema).min(1, "Al menos un usuario").max(100, "Maximo 100 usuarios por lote"),
});

/** Alta de cuenta local para una persona existente en servicio-persona. */
export const crearCuentaUsuarioSchema = empresaAccesoSchema.extend({
  sieCode: z.string().min(1, "sieCode requerido"),
  email: z.string().regex(REGEX_EMAIL, "Correo invalido"),
  rolId: z.string().min(1).nullish(),
});

export const actualizarUsuarioSchema = empresaAccesoSchema.extend({
  id: z.string().min(1, "id requerido"),
});

export const enviarAccesosUsuarioSchema = z.object({
  id: z.string().min(1, "id requerido"),
});

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;
export type CrearUsuariosLoteInput = z.infer<typeof crearUsuariosLoteSchema>;
export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;
