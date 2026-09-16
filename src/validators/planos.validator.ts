import { z } from "zod";
import { TIPOS_PLANO } from "@/lib/shared/constants";

export const planoCrearSchema = z.object({
  codigo: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "Solo minusculas, numeros y guiones"),
  nombre: z.string().min(1).max(100),
  descripcion: z.string().max(300).nullish(),
  tipo: z.enum([TIPOS_PLANO.SIMPLE, TIPOS_PLANO.MACRO] as const).optional(),
});
export const planoMetaSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1).max(100).optional(),
  descripcion: z.string().max(300).nullish(),
  flgActivo: z.boolean().optional(),
  tipo: z.enum([TIPOS_PLANO.SIMPLE, TIPOS_PLANO.MACRO] as const).optional(),
  imagenFondo: z.string().max(500).nullish(),
});

export const planoLayoutSchema = z.object({
  id: z.string().min(1),
  tipos: z.array(z.object({
    codigo: z.string().min(1).max(20),
    label: z.string().min(1).max(20),
    nombre: z.string().min(1).max(50),
    w: z.number().positive(),
    d: z.number().positive(),
    h: z.number().positive(),
    color: z.string().min(1).max(10),
  })),
  bloques: z.array(z.object({
    bloqueId: z.string().min(1).max(50),
    tipoCodigo: z.string().min(1).max(20),
    tipologia: z.string().regex(/^[123]$/).nullish(),
    x: z.number(),
    z: z.number(),
    rotY: z.number().default(0),
    orden: z.number().int().default(0),
    flgActivo: z.boolean().default(true),
  })),
  furniture: z.array(z.object({
    refId: z.string().min(1).max(50),
    tipo: z.string().min(1).max(30),
    x: z.number(),
    z: z.number(),
    rotY: z.number().default(0),
    config: z.unknown().nullish(),
  })).default([]),
});

export const planoImportarSchema = z.object({
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  descripcion: z.string().nullish(),
  tipos: z.array(z.unknown()),
  bloques: z.array(z.unknown()),
  furniture: z.array(z.unknown()).default([]),
});

export const planoSeccionesSchema = z.object({
  id: z.string().min(1),
  secciones: z.array(z.object({
    codigo: z.string().min(1).max(50),
    nombre: z.string().min(1).max(100),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0.01).max(1),
    h: z.number().min(0.01).max(1),
    rotacion: z.number().min(-360).max(360).default(0),
    color: z.string().min(1).max(10),
    planoHijoId: z.string().nullish(),
    orden: z.number().int().default(0),
  })),
});
