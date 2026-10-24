import { z } from "zod";
import { VER_COMO } from "@/lib/shared/constants";

/** Busqueda de empresas del selector "Ver como". */
export const verComoBuscarEmpresasSchema = z.object({
  search: z.string().trim().max(VER_COMO.MAX_BUSQUEDA).optional(),
});

/** Empresa seleccionada en "Ver como". */
export const verComoSeleccionarEmpresaSchema = z.object({
  empresaId: z.string().uuid(),
});

/** Identificador de empresa usado por los endpoints de datos de "Ver como". */
export const verComoEmpresaIdSchema = z.string().uuid();
