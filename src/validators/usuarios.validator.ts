import { z } from "zod";
import { FILTROS_USUARIO_EMPRESA, REGEX_EMAIL, TIPOS_DOCUMENTO_PERSONA } from "@/lib/shared/constants";

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

/**
 * Actualizacion parcial del acceso local: correo del login, estado (habilitado/
 * deshabilitado) y/o empresa (SIE). Empresa requiere ambos campos juntos.
 */
export const actualizarUsuarioSchema = z
  .object({
    id: z.string().min(1, "id requerido"),
    email: z.string().regex(REGEX_EMAIL, "Correo invalido").nullish(),
    flgActivo: z.boolean().nullish(),
    idEmpresa: z.string().min(1, "idEmpresa requerido").nullish(),
    nombreEmpresa: z.string().min(1, "nombreEmpresa requerido").max(200).nullish(),
    ruc: z.string().max(20).nullish(),
  })
  .refine((v) => (v.idEmpresa == null) === (v.nombreEmpresa == null), {
    message: "Empresa incompleta: idEmpresa y nombreEmpresa van juntos",
    path: ["nombreEmpresa"],
  })
  .refine((v) => v.email != null || v.flgActivo != null || v.idEmpresa != null, {
    message: "Indica al menos un cambio (correo, estado o empresa)",
  });

export const enviarAccesosUsuarioSchema = z.object({
  id: z.string().min(1, "id requerido"),
});

/** Query de la bandeja paginada de usuarios (paginacion/busqueda server-side). */
export const usuariosListarSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).optional(),
  filtro: z.enum([FILTROS_USUARIO_EMPRESA.PORTAL, FILTROS_USUARIO_EMPRESA.SIN_EMPRESA]).optional(),
});

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;
export type CrearUsuariosLoteInput = z.infer<typeof crearUsuariosLoteSchema>;
export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;
