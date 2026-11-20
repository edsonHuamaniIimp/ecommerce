import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import {
  API_ERROR_CODES,
  DD_MATRIZ_CRITERIO_PREFIJO,
  DD_MATRIZ_LISTA_URLS,
  DD_MATRIZ_LISTAS,
  DD_MATRIZ_RESULTADOS_FINALES,
  type DdMatrizAdjuntoCategoria,
} from "@/lib/shared/constants";
import { DomainError } from "@/domain/errors/domain-error";
import { getSession } from "@/lib/server/auth";
import { getStorage } from "@/lib/server/storage";
import type { DdMatrizEvaluacionResumenDTO } from "@/types/dto/debida-diligencia";
import type { DdSession } from "@/application/debida-diligencia/debida-diligencia-service";
import { capturarEvidenciaPdf } from "@/infrastructure/browser/dd-evidencia-captura";
import {
  fuenteAutomatizable,
  normalizarResultadoFinal,
  urlFuenteLista,
} from "@/lib/shared/utils/dd-matriz-evaluacion";
import { ddArchivoUtils } from "@/lib/shared/utils/debida-diligencia-archivo";
import {
  mapDdMatrizAdjuntoToDTO,
  mapDdMatrizEvaluacionDetalleToDTO,
  mapDdMatrizEvaluacionListaToDTO,
  mapDdMatrizExportFilaToDTO,
} from "@/lib/shared/mappers/dd-matriz-evaluacion";
import {
  ddMatrizAutomatizarSchema,
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

    const lista = DD_MATRIZ_LISTAS.find((item) => item.codigo === parsed.data.codigo);
    if (!lista || !fuenteAutomatizable(lista.codigo)) {
      return error(
        API_ERROR_CODES.VALIDATION,
        "Esta fuente no admite automatización o requiere login",
        422,
      );
    }

    const detalle = await services.ddMatrizEvaluacion.detalle(session, parsed.data.vinculoId);
    const termino = detalle.vinculo.nombre.trim() || detalle.vinculo.documento?.trim() || "";
    const url = urlFuenteLista(lista.codigo, detalle.vinculo.nombre, detalle.vinculo.documento);
    if (!url) {
      return error(API_ERROR_CODES.VALIDATION, "La fuente no tiene una URL configurada", 422);
    }

    const nombreArchivo = `Evidencia ${lista.label} - ${termino}.pdf`.slice(0, 240);
    const captura = await capturarEvidenciaPdf(
      url,
      termino,
      nombreArchivo,
      DD_MATRIZ_LISTA_URLS[lista.codigo]?.inputSelector,
    );
    const errorArchivo = ddArchivoUtils.validar(
      { nombre: captura.nombre, size: captura.bytes.byteLength, bytes: captura.bytes },
      { soloPdf: true },
    );
    if (errorArchivo) return error(API_ERROR_CODES.VALIDATION, errorArchivo, 400);

    const urlArchivo = await getStorage().upload(
      captura.bytes,
      `${randomUUID()}.pdf`,
      captura.mimeType,
    );
    const categoriaAdjunto =
      `${DD_MATRIZ_CRITERIO_PREFIJO}${lista.codigo}` as DdMatrizAdjuntoCategoria;
    /* Reemplaza la evidencia previa del mismo criterio (evita duplicados al reintentar). */
    const adjuntoPrevio = detalle.adjuntos.find(
      (adjunto) => adjunto.categoria === categoriaAdjunto,
    );
    if (adjuntoPrevio) {
      await services.ddMatrizEvaluacion.eliminarAdjunto(session, adjuntoPrevio.id);
    }
    const adjunto = await services.ddMatrizEvaluacion.registrarAdjunto(session, {
      vinculoId: parsed.data.vinculoId,
      categoria: categoriaAdjunto,
      nombre: captura.nombre,
      url: urlArchivo,
      mimeType: captura.mimeType,
      tamano: captura.bytes.byteLength,
    });
    return success(mapDdMatrizAdjuntoToDTO(adjunto));
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








