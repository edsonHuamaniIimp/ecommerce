import { z } from "zod";
import { ESTADOS_EMPRESA, IDIOMAS, REGEX_EMAIL, REGEX_RUC, TIPOS_COMPROBANTE } from "@/lib/shared/constants";

const emailOpcional = z
  .union([z.literal(""), z.string().trim().regex(REGEX_EMAIL, "Correo invalido")])
  .optional()
  .nullable();

const textoOpcional = z.string().trim().max(250).optional().nullable();

/** Alta de empresa (backoffice). */
export const crearEmpresaSchema = z.object({
  ruc: z.string().trim().regex(REGEX_RUC, "El RUC debe tener 11 digitos"),
  razonSocial: z.string().trim().min(2, "La razon social es obligatoria").max(200),
  nombreComercial: z.string().trim().max(200).optional().nullable(),
  direccionFiscal: textoOpcional,
  telefono: z.string().trim().max(30).optional().nullable(),
  emailContacto: emailOpcional,
  emailFacturacion: emailOpcional,
  representanteLegalNombre: z.string().trim().max(200).optional().nullable(),
  representanteLegalDni: z.string().trim().max(15).optional().nullable(),
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
