import { NextResponse } from "next/server";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES, PERMISSIONS } from "@/lib/shared/constants";
import { autorizarIntegracion } from "@/lib/server/integracion-m2m";
import { StandsIntegracionApplicationService } from "@/application/stands-integracion/stands-integracion-service";
import { standsIntegracionRepo } from "@/infrastructure/persistence/stands-integracion-repository";
import type { AsignarMontajistaInput } from "@/types/dto/stands/stands-integracion.dto";

const service = new StandsIntegracionApplicationService(standsIntegracionRepo);

/**
 * Asignacion de la empresa montajista por stand.
 * Consumible por M2M (`x-api-key`), por staff (`stands:manage`/admin) o por el
 * titular de una reserva **pagada** (cliente) para su propio stand.
 */
export const standsMontajistaController = {
  async asignar(request: Request): Promise<NextResponse> {
    const auth = await autorizarIntegracion(request, PERMISSIONS.STANDS_MANAGE);
    if (!auth.ok) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const body = (await request.json()) as {
      tipo_evento?: number;
      codigo_evento?: number;
      stand_api_id?: string;
      empresa_montajista?: { sie_code?: string; razon_social?: string } | null;
    };
    if (typeof body.tipo_evento !== "number" || typeof body.codigo_evento !== "number" || !body.stand_api_id) {
      return error(API_ERROR_CODES.VALIDATION, "tipo_evento, codigo_evento y stand_api_id requeridos", 400);
    }

    const empresa = body.empresa_montajista ?? null;
    const sie = (empresa?.sie_code ?? "").trim();
    const nombre = (empresa?.razon_social ?? "").trim();
    if (empresa && (!sie || !nombre)) {
      return error(API_ERROR_CODES.VALIDATION, "empresa_montajista requiere sie_code y razon_social (o null para desasignar)", 400);
    }

    const input: AsignarMontajistaInput = {
      tipo_evento: body.tipo_evento,
      codigo_evento: body.codigo_evento,
      stand_api_id: body.stand_api_id,
      empresa_montajista: empresa ? { sie_code: sie, razon_social: nombre } : null,
    };

    // Sesion sin permiso amplio (p. ej. cliente): solo su propia reserva pagada.
    if (auth.origen === "sesion" && !auth.esStaff) {
      const puede = await service.clientePuedeAsignar(input, { userId: auth.userId, email: auth.email });
      if (!puede) {
        return error(API_ERROR_CODES.FORBIDDEN, "Solo el titular de una reserva pagada puede asignar la montajista", 403);
      }
    }

    const result = await service.asignarMontajista(input, auth.email ?? "m2m");
    if (!result) return error(API_ERROR_CODES.NOT_FOUND, "Stand no encontrado para ese evento", 404);
    return success(result);
  },

  /** Catalogo de montajistas (asignadas + busqueda en SIE por `q`). M2M o sesion autenticada. */
  async empresas(request: Request): Promise<NextResponse> {
    const auth = await autorizarIntegracion(request, PERMISSIONS.STANDS_MANAGE);
    if (!auth.ok) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const q = new URL(request.url).searchParams.get("q") ?? undefined;
    return success(await service.listarEmpresasMontajistas(q));
  },
};
