import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { DomainError } from "@/domain/errors/domain-error";
import { getSession } from "@/lib/server/auth";
import type { DdSession } from "@/application/debida-diligencia/debida-diligencia-service";
import {
  mapDdMatrizEvaluacionDetalleToDTO,
  mapDdMatrizEvaluacionListaToDTO,
} from "@/lib/shared/mappers/dd-matriz-evaluacion";
import {
  ddMatrizEvaluacionAdjuntoEliminarSchema,
  ddMatrizEvaluacionAbrirQuerySchema,
  ddMatrizEvaluacionDetalleQuerySchema,
  ddMatrizEvaluacionGuardarSchema,
  ddMatrizEvaluacionQuerySchema,
  ddMatrizEvaluacionVinculoSchema,
} from "@/validators/dd-matriz-evaluacion.validator";

async function sesionRequerida(): Promise<DdSession> {
  const session = await getSession();
  if (!session) throw new DomainError("No autorizado", API_ERROR_CODES.UNAUTHORIZED, 401);
  return {
    email: session.email,
    roles: session.roles,
    permissions: session.permissions,
    eventoId: session.eventoId,
  };
}

function paramsDe(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

/** Controller HTTP de la Matriz de evaluacion DD (`/api/debida-diligencia/matriz-evaluacion/*`). */
export const ddMatrizEvaluacionController = {
  async listar(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const parsed = ddMatrizEvaluacionQuerySchema.safeParse(paramsDe(request));
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues[0]?.message ?? "Consulta inválida", 400);
    }
    const resultado = await services.ddMatrizEvaluacion.listar(session, parsed.data);
    return success(mapDdMatrizEvaluacionListaToDTO(resultado));
  },

  /** Resuelve el id de la fila de la empresa de un expediente (para el boton "Matriz"). */
  async abrir(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const parsed = ddMatrizEvaluacionAbrirQuerySchema.safeParse(paramsDe(request));
    if (!parsed.success) return error(API_ERROR_CODES.VALIDATION, "Expediente inválido", 400);
    const id = await services.ddMatrizEvaluacion.vinculoEmpresaDeExpediente(session, parsed.data.expedienteId);
    return success({ id });
  },

  async detalle(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const parsed = ddMatrizEvaluacionDetalleQuerySchema.safeParse(paramsDe(request));
    if (!parsed.success) return error(API_ERROR_CODES.VALIDATION, "Identificador inválido", 400);
    const detalle = await services.ddMatrizEvaluacion.detalle(session, parsed.data.id);
    return success(mapDdMatrizEvaluacionDetalleToDTO(detalle));
  },

  async guardar(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const parsed = ddMatrizEvaluacionGuardarSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
    }
    const detalle = await services.ddMatrizEvaluacion.guardar(session, parsed.data);
    return success(mapDdMatrizEvaluacionDetalleToDTO(detalle));
  },

  async agregarVinculo(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const parsed = ddMatrizEvaluacionVinculoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
    }
    const detalle = await services.ddMatrizEvaluacion.agregarVinculo(session, parsed.data);
    return success(mapDdMatrizEvaluacionDetalleToDTO(detalle));
  },

  async eliminarVinculo(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const parsed = ddMatrizEvaluacionDetalleQuerySchema.safeParse(await request.json());
    if (!parsed.success) return error(API_ERROR_CODES.VALIDATION, "Identificador inválido", 400);
    await services.ddMatrizEvaluacion.eliminarVinculo(session, parsed.data.id);
    return success({ ok: true });
  },

  async eliminarAdjunto(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const parsed = ddMatrizEvaluacionAdjuntoEliminarSchema.safeParse(await request.json());
    if (!parsed.success) return error(API_ERROR_CODES.VALIDATION, "Identificador inválido", 400);
    await services.ddMatrizEvaluacion.eliminarAdjunto(session, parsed.data.id);
    return success({ ok: true });
  },
};
