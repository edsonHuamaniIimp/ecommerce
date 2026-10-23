import { z } from "zod";
import {
  DD_ACCIONES_LEGAL,
  DD_ACCIONES_REVISION,
  DD_DOCUMENTO_ESTADOS,
  DD_DOCUMENTOS,
  DD_MAX_DOCUMENTOS_EXPEDIENTE,
  DD_ESTADOS,
  DD_ESTADOS_EVALUACION,
  DD_MAX_BENEFICIARIOS,
  DD_MATRIZ_PER_PAGE_MAX,
  DD_MAX_VINCULOS,
  DD_RESULTADOS,
  DD_MAX_OBSERVACIONES,
  DD_PER_PAGE_DEFAULT,
  DD_PORCENTAJE_MAX,
  DD_REPUTACION_RESULTADOS,
  DD_VINCULOS,
  REGEX_EMAIL,
  REGEX_NACIONALIDAD,
} from "@/lib/shared/constants";

/** Convierte los valores de un catalogo en tupla literal para Zod. */
function valores<T extends string>(catalogo: Record<string, T>): [T, ...T[]] {
  return Object.values(catalogo) as [T, ...T[]];
}

const textoNullable = (max: number) =>
  z.union([z.literal(""), z.string().trim().max(max)]).nullable().default(null);

const emailNullable = z
  .union([z.literal(""), z.string().trim().regex(REGEX_EMAIL, "Correo inválido")])
  .nullable()
  .default(null);

const nacionalidadNullable = z
  .union([
    z.literal(""),
    z.string().trim().max(80).regex(REGEX_NACIONALIDAD, "Nacionalidad inválida"),
  ])
  .nullable()
  .default(null);

const tipoRelacionSchema = z.preprocess(
  (valor) => (valor == null ? [] : Array.isArray(valor) ? valor : [valor]),
  z
    .array(z.enum(valores(DD_VINCULOS)))
    .max(DD_MAX_VINCULOS)
    .transform((valores) => [...new Set(valores)]),
);

const tipoDocumentoSchema = z.enum(valores(DD_DOCUMENTOS)).nullable().default(null);

const beneficiarioSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre o razón social es obligatorio").max(200),
  documento: z.string().trim().min(1, "El documento es obligatorio").max(30),
  nacionalidad: z
    .string()
    .trim()
    .min(1, "La nacionalidad es obligatoria")
    .max(80)
    .regex(REGEX_NACIONALIDAD, "Nacionalidad inválida"),
  porcentaje: z
    .number()
    .min(0, "El porcentaje no puede ser negativo")
    .max(DD_PORCENTAJE_MAX, "El porcentaje no puede superar 100"),
});

const documentoSchema = z.object({
  tipo: z.enum(valores(DD_DOCUMENTOS)),
  nombre: z.string().trim().min(1).max(250),
  url: z.string().trim().min(1).max(500),
  estado: z.enum(valores(DD_DOCUMENTO_ESTADOS)).default(DD_DOCUMENTO_ESTADOS.CARGADO),
});

/** Guardado del wizard (borrador o correccion). Los campos son opcionales para permitir guardar por pasos. */
export const ddGuardarSchema = z.object({
  tipoRelacionComercial: tipoRelacionSchema,
  actividadEconomica: textoNullable(120),
  actividadEconomicaOtro: textoNullable(200),
  paisConstitucion: textoNullable(80),
  sitioWeb: textoNullable(200),
  emailRepresentante: emailNullable,
  aceptaDatos: z.boolean().default(false),
  aceptaVerificacion: z.boolean().default(false),
  declaraVerdad: z.boolean().default(false),
  representanteNombre: textoNullable(200),
  representanteTipoDocumento: textoNullable(30),
  representanteDocumento: textoNullable(20),
  representanteNacionalidad: nacionalidadNullable,
  beneficiarios: z
    .array(beneficiarioSchema)
    .max(DD_MAX_BENEFICIARIOS, `Máximo ${DD_MAX_BENEFICIARIOS} beneficiarios`)
    .default([]),
  documentos: z.array(documentoSchema).max(DD_MAX_DOCUMENTOS_EXPEDIENTE).default([]),
});

/** Envio a revision (sin payload adicional; usa los datos guardados). */
export const ddEnviarSchema = z.object({}).optional();

/** Resolucion de Logistica. */
export const ddRevisarSchema = z
  .object({
    expedienteId: z.string().min(1, "expedienteId requerido"),
    accion: z.enum(valores(DD_ACCIONES_REVISION)),
    motivo: textoNullable(1000),
    informeLogisticaUrl: z.string().trim().url("Ingrese un link válido").max(500).nullable().default(null),
    documentosObservados: z.array(z.enum(valores(DD_DOCUMENTOS))).default([]),
    observaciones: z
      .array(
        z.object({
          documentoTipo: tipoDocumentoSchema,
          texto: z.string().trim().min(1, "La observación no puede estar vacía").max(1000),
        }),
      )
      .max(DD_MAX_OBSERVACIONES)
      .default([]),
    derivarComunicaciones: z.boolean().default(false),
  })
  .superRefine((valor, ctx) => {
    if (valor.accion === DD_ACCIONES_REVISION.OBSERVAR) {
            if (valor.observaciones.length === 0 && !valor.motivo?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["observaciones"],
          message: "Registra al menos una observación o un motivo para observar el expediente",
        });
      }
    }
    if (valor.accion === DD_ACCIONES_REVISION.RECHAZAR && !valor.motivo?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["motivo"],
        message: "El motivo del rechazo es obligatorio",
      });
    }
    if (valor.accion === DD_ACCIONES_REVISION.RECHAZAR && !valor.informeLogisticaUrl?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["informeLogisticaUrl"],
        message: "El link del informe de Logística es obligatorio para derivar a Legal",
      });
    }
  });

/** Derivacion manual de nombres a revision reputacional (Comunicaciones). */
export const ddDerivarComunicacionesSchema = z.object({
  expedienteId: z.string().min(1, "expedienteId requerido"),
});

/** Resolucion final de Legal con informe adjunto. */
export const ddLegalResolverSchema = z
  .object({
    expedienteId: z.string().min(1, "expedienteId requerido"),
    decision: z.enum(valores(DD_ACCIONES_LEGAL)),
    motivo: textoNullable(2000),
    documentosObservados: z.array(z.enum(valores(DD_DOCUMENTOS))).max(DD_MAX_DOCUMENTOS_EXPEDIENTE).default([]),
    informeLegalNombre: z.string().trim().max(250).nullable().default(null),
    informeLegalUrl: z.string().trim().max(500).nullable().default(null),
  })
  .superRefine((valor, ctx) => {
    const nombre = valor.informeLegalNombre?.trim() ?? "";
    const url = valor.informeLegalUrl?.trim() ?? "";
    if (valor.decision === DD_ACCIONES_LEGAL.RECHAZAR && !valor.motivo?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["motivo"],
        message: "El motivo del rechazo legal es obligatorio",
      });
    }
    if (valor.decision === DD_ACCIONES_LEGAL.OBSERVAR && !valor.motivo?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["motivo"],
        message: "El motivo de la observación legal es obligatorio",
      });
    }
    if (valor.decision === DD_ACCIONES_LEGAL.RECHAZAR && (!nombre || !url)) {
      ctx.addIssue({
        code: "custom",
        path: ["informeLegalUrl"],
        message: "El informe legal es obligatorio para rechazar",
      });
    }
    if ((nombre && !url) || (!nombre && url)) {
      ctx.addIssue({
        code: "custom",
        path: ["informeLegalUrl"],
        message: "El informe legal debe incluir nombre y archivo",
      });
    }
  });

/** Resolucion de un caso reputacional. */
export const ddReputacionResolverSchema = z
  .object({
    id: z.string().min(1, "id requerido"),
    resultado: z.enum(valores(DD_REPUTACION_RESULTADOS)),
    comentario: textoNullable(1500),
    linkHallazgos: z.string().trim().url("Ingrese un link válido").max(500).nullable().default(null),
    cerrar: z.boolean().default(false),
    notificar: z.boolean().default(true),
  })
  .superRefine((valor, ctx) => {
    if (valor.resultado === DD_REPUTACION_RESULTADOS.CON_HALLAZGOS && !valor.linkHallazgos?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["linkHallazgos"],
        message: "El link de sustento es obligatorio cuando hay hallazgos",
      });
    }
  });

/** Paginacion de las bandejas del modulo. */
export const ddPaginacionSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(DD_PER_PAGE_DEFAULT),
  search: z.string().trim().max(200).optional(),
  estado: z.string().trim().max(40).optional(),
  origen: z.string().trim().max(30).optional(),
  vinculo: z.string().trim().max(40).optional(),
  documentos: z.string().trim().max(20).optional(),
  reputacion: z.string().trim().max(40).optional(),
  asignacion: z.string().trim().max(40).optional(),
  solicitudes: z.string().trim().max(20).optional(),
  orden: z.string().trim().max(30).optional(),
});

/** Paginacion y filtros de la matriz del panel. */
export const ddMatrizQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(DD_MATRIZ_PER_PAGE_MAX).default(DD_PER_PAGE_DEFAULT),
  search: z.string().trim().max(200).optional(),
  estado: z.string().trim().max(40).optional(),
  vinculo: z.string().trim().max(40).optional(),
});

/** Consulta de empresas con estado externo de debida diligencia. */
export const ddEmpresasQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(DD_PER_PAGE_DEFAULT),
  search: z.string().trim().max(200).optional(),
  documento: z.string().trim().max(50).optional(),
  resultado: z.enum(valores(DD_RESULTADOS)).optional(),
  estadoEvaluacion: z.enum(valores(DD_ESTADOS_EVALUACION)).optional(),
  evento: z.string().trim().max(120).optional(),
});

/** Consulta de clientes con evaluacion de debida diligencia. */
export const ddClientesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(DD_PER_PAGE_DEFAULT),
  search: z.string().trim().max(200).optional(),
  ruc: z.string().trim().max(20).optional(),
  estado: z.enum(valores(DD_ESTADOS)).optional(),
  resultado: z.enum(valores(DD_RESULTADOS)).optional(),
  estadoEvaluacion: z.enum(valores(DD_ESTADOS_EVALUACION)).optional(),
});
