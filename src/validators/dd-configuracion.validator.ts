import { z } from "zod";
import {
  DD_CONFIG_CIERRE_ESTADOS,
  DD_CONFIG_VIGENCIAS,
} from "@/lib/shared/constants";

const urlNullable = z
  .union([z.literal(""), z.string().trim().max(500)])
  .nullable()
  .optional()
  .transform((valor) => (valor?.trim() ? valor.trim() : null));

export const ddConfiguracionSchema = z.object({
  plazoDiasHabiles: z.number().int().min(1).max(30),
  estadoCierreAutomatico: z.enum(
    Object.values(DD_CONFIG_CIERRE_ESTADOS) as [string, ...string[]],
  ),
  exigirEvidencia: z.boolean(),
  permitirNaSinEvidencia: z.boolean(),
  revalidacionDeclaracion: z.boolean(),
  noAptoBloqueaEmpresa: z.boolean(),
  legalSoloDerivacionSig: z.boolean(),
  vigenciaMeses: z
    .number()
    .int()
    .refine((valor) => DD_CONFIG_VIGENCIAS.some((opcion) => opcion.meses === valor), {
      message: "Vigencia predeterminada inválida",
    }),
  permitirReutilizacionVinculo: z.boolean(),
  asistenteIaHabilitado: z.boolean(),
  manualUrl: urlNullable,
  reglamentoUrl: urlNullable,
  plantillaInformeUrl: urlNullable,
  linkListasUrl: urlNullable,
});
