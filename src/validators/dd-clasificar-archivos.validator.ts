import { z } from "zod";
import { DD_REPOSITORIO_IMPORT_MAX_ARCHIVOS } from "@/lib/shared/constants";

export const ddClasificarArchivosSchema = z.object({
  empresa: z.object({
    id: z.string().trim().min(1).max(60),
    razonSocial: z.string().trim().min(1).max(250),
    ruc: z.string().trim().min(1).max(50),
  }),
  vinculos: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(60),
        nombre: z.string().trim().min(1).max(250),
        tipo: z.string().trim().min(1).max(30),
      }),
    )
    .max(100),
  archivos: z
    .array(z.object({ nombre: z.string().trim().min(1).max(300) }))
    .min(1)
    .max(DD_REPOSITORIO_IMPORT_MAX_ARCHIVOS),
});
