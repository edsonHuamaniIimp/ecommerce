import { z } from "zod";
import { MAX_PRE_RESERVA_LOTE } from "@/lib/shared/constants";

export const updateGessStandSchema = z.object({
  id: z.string().min(1),
  bloqueId: z.string().nullable().optional(),
  documentos: z.array(z.string()).optional(),
  imagenes: z.array(z.string()).optional(),
  /** Categoria por url de imagen: { "<url>": "<categoria>" }. */
  imagenesCategorias: z.record(z.string(), z.string()).optional(),
  /** Categoria por url de documento (contrato/anexo/otro): { "<url>": "<categoria>" }. */
  documentosCategorias: z.record(z.string(), z.string()).optional(),
  estado: z.string().optional(),
});

/** Pre-reserva en lote: empresa del buscador de entidades o titulo libre (al menos uno). */
export const preReservaSchema = z.object({
  standIds: z.array(z.string().min(1)).min(1).max(MAX_PRE_RESERVA_LOTE),
  razonSocial: z.string().max(200).nullish(),
  titulo: z.string().max(200).nullish(),
  ruc: z.string().max(20).nullish(),
  sie: z.string().max(20).nullish(),
  logoUrl: z.string().max(500).nullish(),
  nota: z.string().max(300).nullish(),
});

/** Edicion de una pre-reserva vigente (empresa/titulo/logo/nota). */
export const actualizarPreReservaSchema = z.object({
  standId: z.string().min(1),
  razonSocial: z.string().max(200).nullish(),
  titulo: z.string().max(200).nullish(),
  ruc: z.string().max(20).nullish(),
  sie: z.string().max(20).nullish(),
  logoUrl: z.string().max(500).nullish(),
  nota: z.string().max(300).nullish(),
});

/** Liberacion de pre-reservas en lote. */
export const liberarPreReservaSchema = z.object({
  standIds: z.array(z.string().min(1)).min(1).max(MAX_PRE_RESERVA_LOTE),
});

export type UpdateGessStandInput = z.infer<typeof updateGessStandSchema>;
