import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";

/**
 * RF-08: ubicacion de un bloque de stand en el plano (pabellon + macro), para el
 * recorte del pabellon con el stand destacado. Publico (solo lectura).
 */
export async function GET(request: Request) {
  const bloqueId = new URL(request.url).searchParams.get("bloqueId");
  if (!bloqueId) return error(API_ERROR_CODES.VALIDATION, "bloqueId requerido", 400);

  const ubicacion = await services.planos.ubicacionDeBloque(bloqueId);
  if (!ubicacion) return error(API_ERROR_CODES.NOT_FOUND, "El bloque no tiene plano asociado", 404);
  return success(ubicacion);
}
