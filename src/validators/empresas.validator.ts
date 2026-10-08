import { z } from "zod";
import { ESTADOS_EMPRESA, IDIOMAS, REGEX_EMAIL, REGEX_RUC, TIPOS_COMPROBANTE, TIPOS_DOCUMENTO_EMPRESA, TIPOS_DOCUMENTO_PERSONA, UBIGEO_PAIS_PERU } from "@/lib/shared/constants";

const emailOpcional = z
  .union([z.literal(""), z.string().trim().regex(REGEX_EMAIL, "Correo invalido")])
  .optional()
  .nullable();

const textoOpcional = z.string().trim().max(250).optional().nullable();

/** Alta de empresa (backoffice). */
export const crearEmpresaSchema = z.object({
  ruc: z.string().trim().regex(REGEX_RUC, "El RUC debe tener 11 digitos"),
  razonSocial: z.string().trim().min(2, "La razon social es obligatoria").max(200),
  sieCode: z.string().trim().max(20).optional().nullable(),
  logoUrl: z.string().max(500).optional().nullable(),
  nombreComercial: z.string().trim().max(200).optional().nullable(),
  direccionFiscal: textoOpcional,
  telefono: z.string().trim().max(30).optional().nullable(),
  emailContacto: emailOpcional,
  emailFacturacion: emailOpcional,
  representanteLegalNombre: z.string().trim().max(200).optional().nullable(),
  representanteLegalDni: z.string().trim().max(15).optional().nullable(),
  partidaElectronica: z.string().trim().max(50).optional().nullable(),
  representanteDireccion: z.string().trim().max(100).optional().nullable(),
  representanteCorreo: emailOpcional,
  representanteCelular: z.string().trim().max(35).optional().nullable(),
  representanteFotoUrl: z.string().max(2048).optional().nullable(),
  tipoComprobante: z.enum([TIPOS_COMPROBANTE.FACTURA, TIPOS_COMPROBANTE.BOLETA]).optional().nullable(),
  sitioWeb: z.string().trim().max(200).optional().nullable(),
});

/** Edicion parcial (solo campos enviados). */
export const actualizarEmpresaSchema = crearEmpresaSchema.partial().extend({
  id: z.string().min(1, "id requerido"),
});

/** Activar/desactivar empresa. */
export const cambiarEstadoEmpresaSchema = z.object({
  id: z.string().min(1, "id requerido"),
  estado: z.enum([ESTADOS_EMPRESA.ACTIVA, ESTADOS_EMPRESA.INACTIVA]),
});

/** Operaciones que solo requieren el id de la empresa. */
export const idEmpresaSchema = z.object({
  id: z.string().min(1, "id requerido"),
});

/** Crear cuenta del Portal: permite indicar el correo del representante si la ficha no lo tiene. */
export const crearCuentaEmpresaSchema = idEmpresaSchema.extend({
  email: z.string().trim().regex(REGEX_EMAIL, "Correo invalido").optional().nullable(),
});

/** Fila de la carga masiva (texto plano del archivo). */
const filaCargaEmpresaSchema = z.object({
  numero: z.number().int().nonnegative(),
  ruc: z.string(),
  razonSocial: z.string(),
  nombreComercial: z.string(),
  direccionFiscal: z.string(),
  telefono: z.string(),
  emailContacto: z.string(),
  emailFacturacion: z.string(),
  representanteLegalNombre: z.string(),
  representanteLegalDni: z.string(),
  tipoComprobante: z.string(),
  sitioWeb: z.string(),
});

/** Importacion de la carga masiva (filas previamente previsualizadas). */
export const importarCargaEmpresasSchema = z.object({
  filas: z.array(filaCargaEmpresaSchema).min(1, "filas requeridas"),
});

/** Validacion/actualizacion de los datos de la empresa en el Portal (primer ingreso). */
export const validarDatosEmpresaSchema = crearEmpresaSchema;

/** Cambio del idioma preferido del usuario. */
export const cambiarIdiomaSchema = z.object({
  idioma: z.enum([IDIOMAS.ES, IDIOMAS.EN]),
});

/** Busqueda de empresas en la fuente servicio-persona (mismo criterio que personas). */
export const buscarEmpresaFuenteSchema = z.object({
  q: z.string().trim().min(3, "q requerido (minimo 3 caracteres)").max(120),
});

/** Busqueda de una persona en el padron interno (servicio-persona) por documento exacto. */
export const buscarPersonaFuenteSchema = z.object({
  tipoDocumento: z.enum([TIPOS_DOCUMENTO_PERSONA.DNI, TIPOS_DOCUMENTO_PERSONA.CARNE_EXTRANJERIA, TIPOS_DOCUMENTO_PERSONA.PASAPORTE]),
  numeroDocumento: z.string().trim().min(1, "numeroDocumento requerido").max(15),
});

/** Empresa a registrar en servicio-persona (se crea en la fuente si no existe). */
const registrarEmpresaFuenteSchema = z.object({
  nombre: z.string().trim().min(2, "La razon social es obligatoria").max(100),
  idTipoDocumento: z.enum([TIPOS_DOCUMENTO_EMPRESA.RUC, TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO]),
  documento: z.string().trim().min(1, "El documento es obligatorio").max(20),
  direccion: z.string().trim().min(1, "La direccion es obligatoria").max(200),
  correo: z.string().trim().regex(REGEX_EMAIL, "Correo invalido").max(101),
  telefono: z.string().trim().min(1, "El telefono es obligatorio").max(35),
  pais: z.number().int().positive().default(UBIGEO_PAIS_PERU),
  linkLogo: z.string().max(2048).optional().nullable(),
});

/** Persona de contacto (se reutiliza por documento o se crea en la fuente). */
const registrarPersonaContactoSchema = z.object({
  tipoDocumento: z.enum([TIPOS_DOCUMENTO_PERSONA.DNI, TIPOS_DOCUMENTO_PERSONA.CARNE_EXTRANJERIA, TIPOS_DOCUMENTO_PERSONA.PASAPORTE]),
  documento: z.string().trim().min(1, "El documento del contacto es obligatorio").max(15),
  apellidoPaterno: z.string().trim().min(1, "El apellido paterno es obligatorio").max(30),
  apellidoMaterno: z.string().trim().max(30).optional().nullable(),
  nombres: z.string().trim().min(1, "Los nombres son obligatorios").max(30),
  celular: z.string().trim().max(35).optional().nullable(),
  direccion: z.string().trim().max(100).optional().nullable(),
});

/** Registro de la relacion usuario (persona) - empresa (fuente servicio-persona). */
export const registrarCuentaEmpresaSchema = z.object({
  sieCodeEmpresa: z.string().trim().max(20).optional().nullable(),
  empresa: registrarEmpresaFuenteSchema,
  persona: registrarPersonaContactoSchema,
  email: z.string().trim().regex(REGEX_EMAIL, "Correo invalido"),
  rolId: z.string().trim().optional().nullable(),
});
