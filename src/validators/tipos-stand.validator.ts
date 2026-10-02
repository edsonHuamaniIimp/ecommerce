import { z } from "zod";

/** Cuerpo de POST `/api/gess/tipos-imagen` (imagen referencial por tipo de stand). */
export const guardarTipoStandImagenSchema = z.object({
  tipo: z.string().min(1, "tipo requerido").max(50),
  imagenUrl: z.string().min(1, "imagenUrl requerida").max(500),
});
