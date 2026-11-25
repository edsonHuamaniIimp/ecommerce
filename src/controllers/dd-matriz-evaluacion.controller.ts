import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import {
  automatizarCriterio,
  estadoAutomatizacion,
  iniciarAutomatizacionGeneral,
} from "@/lib/server/dd-matriz-automatizacion";
import { success, error } from "@/lib/server/api-response";
import { exigirLimiteConsultas } from "@/lib/server/limite-consultas";
import {
  API_ERROR_CODES,
  DD_ASISTENTE,
  DD_ASISTENTE_MENSAJES,
  DD_MATRIZ_RESULTADOS_FINALES,
} from "@/lib/shared/constants";
import { DomainError } from "@/domain/errors/domain-error";
import { getSession } from "@/lib/server/auth";
import type { DdMatrizAsistenteResponseDTO, DdMatrizEvaluacionResumenDTO } from "@/types/dto/debida-diligencia";
import type { DdSession } from "@/application/debida-diligencia/debida-diligencia-service";
import {
  normalizarResultadoFinal,
} from "@/lib/shared/utils/dd-matriz-evaluacion";
import {
  mapDdMatrizAdjuntoToDTO,
  mapDdMatrizEvaluacionDetalleToDTO,
  mapDdMatrizEvaluacionListaToDTO,
  mapDdMatrizExportFilaToDTO,
} from "@/lib/shared/mappers/dd-matriz-evaluacion";
import {
  ddMatrizAsistenteSchema,
  ddMatrizAutomatizacionEstadoQuerySchema,
  ddMatrizAutomatizarSchema,
  ddMatrizAutomatizarTodoSchema,
  ddMatrizEvaluacionAdjuntoEliminarSchema,
  ddMatrizEvaluacionAbrirQuerySchema,
  ddMatrizEvaluacionDetalleQuerySchema,
  ddMatrizEvaluacionExportarSchema,
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

async function usuarioIdRequerido(): Promise<string> {
  const session = await getSession();
  if (!session) throw new DomainError("No autorizado", API_ERROR_CODES.UNAUTHORIZED, 401);
  return session.sub;
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

  /** Indicadores (stats) de la matriz del evento o de todos los eventos. */
  async resumen(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const eventoId = new URL(request.url).searchParams.get("eventoId") ?? undefined;
    const resumen = await services.ddMatrizEvaluacion.resumen(session, eventoId);
    return success<DdMatrizEvaluacionResumenDTO>(resumen);
  },

  /** Datos completos de los vinculos elegidos (o filtrados) para armar el Excel oficial. */
  async exportar(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const parsed = ddMatrizEvaluacionExportarSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
    }
    const items = await services.ddMatrizEvaluacion.exportar(session, parsed.data);
    return success({ data: items.map(mapDdMatrizExportFilaToDTO), total: items.length });
  },

  /** Busca en el portal público, captura un PDF y lo adjunta al criterio. */
  async automatizar(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const parsed = ddMatrizAutomatizarSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
    }
    const adjunto = await automatizarCriterio(session, parsed.data.vinculoId, parsed.data.codigo);
    return success(mapDdMatrizAdjuntoToDTO(adjunto));
  },

  /**
   * Asistente de la observacion del criterio: IA con el archivo u OCR + IA. No guarda nada.
   * @request DdMatrizAsistenteRequestDTO
   */
  async asistente(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const parsed = ddMatrizAsistenteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
    }
    exigirLimiteConsultas(
      `${DD_ASISTENTE.ACCION_AUDITORIA}:${session.email}`,
      DD_ASISTENTE.LIMITE_POR_VENTANA,
      DD_ASISTENTE.VENTANA_MS,
      DD_ASISTENTE_MENSAJES.LIMITE,
    );
    const resultado: DdMatrizAsistenteResponseDTO = await services.ddMatrizAsistente.generar(session, parsed.data);
    return success(resultado, { headers: { "Cache-Control": "no-store" } });
  },

  /** Lanza en segundo plano la automatizacion de todos los criterios del vinculo (202). */
  async automatizarTodo(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const usuarioId = await usuarioIdRequerido();
    const parsed = ddMatrizAutomatizarTodoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
    }
    const job = await iniciarAutomatizacionGeneral(session, usuarioId, parsed.data.vinculoId);
    return success(job, { status: 202 });
  },

  /** Avance de una automatizacion general (404 si el proceso ya no lo conoce). */
  async estadoAutomatizacion(request: Request): Promise<NextResponse> {
    await sesionRequerida();
    const usuarioId = await usuarioIdRequerido();
    const parsed = ddMatrizAutomatizacionEstadoQuerySchema.safeParse(paramsDe(request));
    if (!parsed.success) return error(API_ERROR_CODES.VALIDATION, "Automatización inválida", 400);
    const job = estadoAutomatizacion(usuarioId, parsed.data.jobId);
    if (!job) return error(API_ERROR_CODES.NOT_FOUND, "La automatización ya no está disponible", 404);
    return success(job);
  },
  async guardar(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const parsed = ddMatrizEvaluacionGuardarSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
    }

    const esDocumentacionObservada =
      normalizarResultadoFinal(parsed.data.resultadoFinal) ===
      DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA;
    if (esDocumentacionObservada) {
      const previo = await services.ddMatrizEvaluacion.detalle(session, parsed.data.id);
      await services.debidaDiligencia.observarDocumentacionFinal(
        {
          expedienteId: previo.vinculo.expediente.expedienteId,
          motivo: parsed.data.clienteComentario ?? null,
          documentosObservados: parsed.data.documentosObservados,
          vinculosObservados: parsed.data.vinculosObservados,
        },
        session,
      );
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








