import { z } from "zod";
import {
  DD_MATRIZ_ADJUNTO_CATEGORIAS,
  DD_MATRIZ_AMBITOS,
  DD_MATRIZ_EVAL_PER_PAGE_MAX,
  DD_MATRIZ_OBSERVACION_MAX,
  DD_MATRIZ_PER_PAGE_DEFAULT,
  DD_MATRIZ_TIPOS_VINCULO,
  REGEX_PAIS,
} from "@/lib/shared/constants";

/** Convierte los valores de un catalogo en tupla literal para Zod. */
function valores<T extends string>(catalogo: Record<string, T>): [T, ...T[]] {
  return Object.values(catalogo) as [T, ...T[]];
}

const textoNullable = (max: number) =>
  z.union([z.literal(""), z.string().trim().max(max)]).nullable().optional();

/**
 * Los valores de catalogo (resultado, conclusion, SI/NO/N.A.) se reciben como texto
 * libre: el mapper del servicio los reconoce en formato de negocio o de desarrollo.
 */
const valorCatalogo = z.string().trim().max(80).nullable().optional();

const fechaNullable = z
  .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")])
  .nullable()
  .optional();

const bloqueSchema = z
  .object({
    fecha: fechaNullable,
    responsable: textoNullable(200),
    resultado: valorCatalogo,
    observaciones: textoNullable(DD_MATRIZ_OBSERVACION_MAX),
    conclusion: valorCatalogo,
  })
  .optional();

/** Consulta de la lista de la matriz. */
export const ddMatrizEvaluacionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(DD_MATRIZ_EVAL_PER_PAGE_MAX).default(DD_MATRIZ_PER_PAGE_DEFAULT),
  search: z.string().trim().max(200).optional(),
  tipo: z.enum(valores(DD_MATRIZ_TIPOS_VINCULO)).optional(),
  ambito: z.enum(valores(DD_MATRIZ_AMBITOS)).optional(),
  pais: z
    .string()
    .trim()
    .toUpperCase()
    .regex(REGEX_PAIS, "País inválido: usa el código ISO de 2 letras")
    .optional(),
  sinPais: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  resultadoFinal: z.string().trim().max(40).optional(),
  sinEvaluar: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const ddMatrizEvaluacionAbrirQuerySchema = z.object({
  expedienteId: z.string().trim().min(1).max(60),
});

export const ddMatrizEvaluacionDetalleQuerySchema = z.object({
  id: z.string().trim().min(1).max(60),
});

/** Guardado parcial: solo se procesan las secciones presentes. */
export const ddMatrizEvaluacionGuardarSchema = z.object({
  id: z.string().trim().min(1).max(60),
  identidad: z
    .object({
      nombre: z.string().trim().min(1).max(250).optional(),
      tipoDocumento: textoNullable(30),
      documento: textoNullable(30),
      nacionalidad: textoNullable(80),
      cargo: textoNullable(120),
      ambito: z.enum(valores(DD_MATRIZ_AMBITOS)).optional(),
      pais: textoNullable(80),
    })
    .optional(),
  generales: z
    .object({
      fechaInicioActividades: z
        .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")])
        .nullable()
        .optional(),
      estadoContribuyente: textoNullable(80),
      direccionLegal: textoNullable(400),
      actividadEconomica: textoNullable(200),
      motivo: textoNullable(250),
      eventoProyecto: textoNullable(120),
      historialIimp: valorCatalogo,
      beneficioMutuo: valorCatalogo,
    })
    .optional(),
  listas: z.record(z.string().max(40), z.string().trim().max(20).nullable()).optional(),
  sig: bloqueSchema,
  reputacional: bloqueSchema,
  compliance: bloqueSchema,
  resultadoFinal: valorCatalogo,
  finalFecha: fechaNullable,
  finalPor: textoNullable(200),
});

/** Alta manual de un vinculo (persona o empresa vinculada). */
export const ddMatrizEvaluacionVinculoSchema = z.object({
  expedienteId: z.string().trim().min(1).max(60),
  tipo: z.enum(valores(DD_MATRIZ_TIPOS_VINCULO)),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(250),
  tipoDocumento: textoNullable(30),
  documento: textoNullable(30),
  nacionalidad: textoNullable(80),
  cargo: textoNullable(120),
  ambito: z.enum(valores(DD_MATRIZ_AMBITOS)).optional(),
  pais: textoNullable(80),
});

export const ddMatrizEvaluacionAdjuntoEliminarSchema = z.object({
  id: z.string().trim().min(1).max(60),
});

/** Categoria enviada en la carga multipart de un adjunto. */
export const ddMatrizEvaluacionAdjuntoCategoriaSchema = z.enum(valores(DD_MATRIZ_ADJUNTO_CATEGORIAS));
