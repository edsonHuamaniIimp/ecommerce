import { z } from "zod";
import { REGEX_EMAIL } from "@/lib/shared/constants";

const emailOpcional = z
  .union([z.literal(""), z.string().trim().regex(REGEX_EMAIL, "Correo invalido").max(200)])
  .optional()
  .nullable();

const urlOpcional = z
  .union([z.literal(""), z.string().trim().regex(/^https?:\/\/.+/i, "URL invalida (debe iniciar con http:// o https://)").max(500)])
  .optional()
  .nullable();

/** Guardado de la configuracion publica del portal (login/presala). */
export const actualizarPortalConfigSchema = z.object({
  mesaAyudaEmail: emailOpcional,
  contactoEmail: emailOpcional,
  manualUrl: urlOpcional,
  reglamentoUrl: urlOpcional,
});

export type ActualizarPortalConfigInput = z.infer<typeof actualizarPortalConfigSchema>;
