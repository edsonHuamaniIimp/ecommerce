import { z } from "zod";
import { REGEX_RUC } from "@/lib/shared/constants";

const tipoDocumento = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.enum(["RUC", "RUT"]))
  .optional();

/** Query de consulta externa de empresas y documentos DD. */
export const ddIntegracionDocumentosQuerySchema = z
  .object({
    tipoDocumento,
    documento: z.string().trim().max(20).optional(),
    razonSocial: z.string().trim().min(2).max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(50).default(20),
  })
  .superRefine((valor, ctx) => {
    if (!valor.documento && !valor.razonSocial) {
      ctx.addIssue({
        code: "custom",
        path: ["documento"],
        message: "Indique documento o razón social",
      });
    }
    if (valor.documento && !valor.tipoDocumento) {
      ctx.addIssue({
        code: "custom",
        path: ["tipoDocumento"],
        message: "tipoDocumento es obligatorio cuando se consulta por documento",
      });
    }
    if (valor.tipoDocumento && !valor.documento) {
      ctx.addIssue({
        code: "custom",
        path: ["documento"],
        message: "documento es obligatorio cuando se indica tipoDocumento",
      });
    }
    if (
      valor.documento &&
      valor.tipoDocumento === "RUC" &&
      !REGEX_RUC.test(valor.documento.trim())
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["documento"],
        message: "El RUC debe tener 11 dígitos",
      });
    }
  });

export type DdIntegracionDocumentosQuery = z.infer<typeof ddIntegracionDocumentosQuerySchema>;
