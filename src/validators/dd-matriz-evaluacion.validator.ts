import { z } from "zod";
import { normalizarResultadoFinal } from "@/lib/shared/utils/dd-matriz-evaluacion";
import {
  DD_MATRIZ_ADJUNTO_CATEGORIAS,
  DD_MATRIZ_LISTA_OBSERVACION_EXTENDIDA_MAX,
  DD_MATRIZ_AMBITOS,
  DD_MATRIZ_CRITERIO_PREFIJO,
  DD_MATRIZ_EVAL_PER_PAGE_MAX,
  DD_MATRIZ_EXPORT_MAX,
  DD_MATRIZ_FINAL_COMENTARIO_MAX,
  DD_MATRIZ_LISTAS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_DOCUMENTOS,
  DD_MATRIZ_OBSERVACION_MAX,
  DD_OBSERVACION_VINCULO_TIPOS,
  DD_MATRIZ_PER_PAGE_DEFAULT,
  DD_MATRIZ_TIPOS_VINCULO,
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

/** Uno o varios codigos ISO alpha-2 separados por coma (maximo 60). */
const REGEX_PAISES_LISTA = /^[A-Za-z]{2}(,[A-Za-z]{2}){0,59}$/;
const REGEX_FECHA_ISO = /^d{4}-d{2}-d{2}$/;

/** Consulta de la lista de la matriz. */
export const ddMatrizEvaluacionQuerySchema = z.object({
  eventoId: z.string().trim().max(64).optional(),
  expedienteId: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(DD_MATRIZ_EVAL_PER_PAGE_MAX).default(DD_MATRIZ_PER_PAGE_DEFAULT),
  search: z.string().trim().max(200).optional(),
  tipo: z.enum(valores(DD_MATRIZ_TIPOS_VINCULO)).optional(),
  ambito: z.enum(valores(DD_MATRIZ_AMBITOS)).optional(),
  pais: z
    .string()
    .trim()
    .toUpperCase()
    .regex(REGEX_PAISES_LISTA, "País inválido: usa códigos ISO de 2 letras separados por coma")
    .optional(),
  fechaDesde: z.string().trim().regex(REGEX_FECHA_ISO, "Fecha inválida: usa AAAA-MM-DD").optional(),
  fechaHasta: z.string().trim().regex(REGEX_FECHA_ISO, "Fecha inválida: usa AAAA-MM-DD").optional(),
  sinPais: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  resultadoFinal: z.string().trim().max(40).optional(),
  sinEvaluar: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  porEmpresa: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

/** Exportacion: ids elegidos o los filtros de la lista. */
export const ddMatrizEvaluacionExportarSchema = z.object({
  eventoId: z.string().trim().max(64).optional(),
  ids: z.array(z.string().trim().min(1).max(60)).min(1).max(DD_MATRIZ_EXPORT_MAX).optional(),
  search: z.string().trim().max(200).optional(),
  tipo: z.enum(valores(DD_MATRIZ_TIPOS_VINCULO)).optional(),
  ambito: z.enum(valores(DD_MATRIZ_AMBITOS)).optional(),
  pais: z
    .string()
    .trim()
    .toUpperCase()
    .regex(REGEX_PAISES_LISTA, "País inválido: usa códigos ISO de 2 letras separados por coma")
    .optional(),
  fechaDesde: z.string().trim().regex(REGEX_FECHA_ISO, "Fecha inválida: usa AAAA-MM-DD").optional(),
  fechaHasta: z.string().trim().regex(REGEX_FECHA_ISO, "Fecha inválida: usa AAAA-MM-DD").optional(),
  sinPais: z.boolean().optional(),
  resultadoFinal: z.string().trim().max(40).optional(),
  sinEvaluar: z.boolean().optional(),
});

export const ddMatrizAutomatizarSchema = z.object({
  vinculoId: z.string().trim().min(1).max(64),
  codigo: z.string().trim().min(1).max(40),
});

export const ddMatrizAutomatizarTodoSchema = z.object({
  vinculoId: z.string().trim().min(1).max(64),
});

export const ddMatrizAutomatizacionEstadoQuerySchema = z.object({
  jobId: z.string().trim().min(1).max(64),
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
  borrador: z.boolean().optional(),
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
  /** El limite por criterio lo aplica el servicio; aqui solo el techo absoluto. */
  listasObservaciones: z
    .record(z.string().max(40), z.string().max(DD_MATRIZ_LISTA_OBSERVACION_EXTENDIDA_MAX).nullable())
    .optional(),
  sig: bloqueSchema,
  reputacional: bloqueSchema,
  compliance: bloqueSchema,
  resultadoFinal: valorCatalogo,
  finalFecha: fechaNullable,
  finalPor: textoNullable(200),
  finalComentario: textoNullable(DD_MATRIZ_FINAL_COMENTARIO_MAX),
  clienteComentario: textoNullable(1000),
  documentosObservados: z.array(z.enum(valores(DD_DOCUMENTOS))).default([]),
  vinculosObservados: z
    .array(
      z.object({
        tipo: z.enum(valores(DD_OBSERVACION_VINCULO_TIPOS)),
        beneficiarioId: z.string().trim().max(60).nullable().optional(),
        comentario: textoNullable(1000),
      }),
    )
    .default([]),
}).superRefine((valor, ctx) => {
  for (const [indice, vinculo] of valor.vinculosObservados.entries()) {
    if (vinculo.tipo === DD_OBSERVACION_VINCULO_TIPOS.BENEFICIARIO && !vinculo.beneficiarioId) {
      ctx.addIssue({
        code: "custom",
        path: ["vinculosObservados", indice, "beneficiarioId"],
        message: "El beneficiarioId es obligatorio para un vínculo observado",
      });
    }
  }
  const esDocumentacionObservada =
    normalizarResultadoFinal(valor.resultadoFinal) ===
    DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA;
  const hayComentarioVinculo = valor.vinculosObservados.some((vinculo) =>
    Boolean(vinculo.comentario?.trim()),
  );
  if (esDocumentacionObservada && !valor.clienteComentario?.trim() && !hayComentarioVinculo) {
    ctx.addIssue({
      code: "custom",
      path: ["clienteComentario"],
      message:
        "El comentario general o al menos un comentario de vínculo es obligatorio para DOCUMENTACIÓN OBSERVADA",
    });
  }
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

/** Categorias de evidencia por criterio: `criterio_<codigo de lista>`. */
const CATEGORIAS_CRITERIO = DD_MATRIZ_LISTAS.map((lista) => `${DD_MATRIZ_CRITERIO_PREFIJO}${lista.codigo}`);
const CATEGORIAS_ADJUNTO = [
  ...Object.values(DD_MATRIZ_ADJUNTO_CATEGORIAS),
  ...CATEGORIAS_CRITERIO,
];

/** Categoria enviada en la carga multipart de un adjunto. */
export const ddMatrizEvaluacionAdjuntoCategoriaSchema = z
  .string()
  .trim()
  .refine((valor) => CATEGORIAS_ADJUNTO.includes(valor), {
    message: "Categoría de adjunto inválida",
  });

