import "server-only";

import { randomUUID } from "node:crypto";
import type { DdSession } from "@/application/debida-diligencia/debida-diligencia-service";
import { capturarEvidenciaPdf } from "@/infrastructure/browser/dd-evidencia-captura";
import { DomainError } from "@/domain/errors/domain-error";
import {
  API_ERROR_CODES,
  DD_AUTOMATIZACION_ESTADOS,
  DD_AUTOMATIZACION_EVENTO,
  DD_AUTOMATIZACION_TTL_MS,
  DD_MATRIZ_CRITERIO_PREFIJO,
  DD_MATRIZ_LISTA_OTROS,
  DD_MATRIZ_LISTA_URLS,
  DD_MATRIZ_LISTAS,
  type DdMatrizAdjuntoCategoria,
} from "@/lib/shared/constants";
import { getPusher, canalUsuario } from "@/lib/server/pusher";
import { services } from "@/lib/server/services";
import { getStorage } from "@/lib/server/storage";
import { fuenteAutomatizable, listasAplicables, urlFuenteLista } from "@/lib/shared/utils/dd-matriz-evaluacion";
import { ddArchivoUtils } from "@/lib/shared/utils/debida-diligencia-archivo";
import type {
  DdMatrizAutomatizacionCriterioDTO,
  DdMatrizAutomatizacionDTO,
} from "@/types/dto/debida-diligencia";

interface Job extends DdMatrizAutomatizacionDTO {
  usuarioId: string;
  creadoEn: number;
}

/* El estado vive en memoria del proceso (sobrevive al HMR en dev). Si el cliente consulta
 * un job que no esta aqui (otra tarea, reinicio), simplemente refresca el detalle. */
const globalJobs = globalThis as unknown as { __ddAutomatizacionJobs?: Map<string, Job> };
const jobs: Map<string, Job> = (globalJobs.__ddAutomatizacionJobs ??= new Map());

function limpiarVencidos(): void {
  const limite = Date.now() - DD_AUTOMATIZACION_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.estado !== DD_AUTOMATIZACION_ESTADOS.EN_CURSO && job.creadoEn < limite) jobs.delete(id);
  }
}

/** Busca el portal, captura el PDF y lo adjunta (reemplazando el previo) a un criterio del vinculo. */
export async function automatizarCriterio(session: DdSession, vinculoId: string, codigo: string) {
  const lista = DD_MATRIZ_LISTAS.find((item) => item.codigo === codigo);
  if (!lista || !fuenteAutomatizable(lista.codigo)) {
    throw new DomainError(
      "Esta fuente no admite automatización o requiere login",
      API_ERROR_CODES.VALIDATION,
      422,
    );
  }

  const detalle = await services.ddMatrizEvaluacion.detalle(session, vinculoId);
  const termino = detalle.vinculo.nombre.trim() || detalle.vinculo.documento?.trim() || "";
  const url = urlFuenteLista(lista.codigo, detalle.vinculo.nombre, detalle.vinculo.documento);
  if (!url) {
    throw new DomainError("La fuente no tiene una URL configurada", API_ERROR_CODES.VALIDATION, 422);
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
  if (errorArchivo) throw new DomainError(errorArchivo, API_ERROR_CODES.VALIDATION, 400);

  const urlArchivo = await getStorage().upload(captura.bytes, `${randomUUID()}.pdf`, captura.mimeType);
  const categoriaAdjunto = `${DD_MATRIZ_CRITERIO_PREFIJO}${lista.codigo}` as DdMatrizAdjuntoCategoria;
  const adjuntoPrevio = detalle.adjuntos.find((adjunto) => adjunto.categoria === categoriaAdjunto);
  if (adjuntoPrevio) {
    await services.ddMatrizEvaluacion.eliminarAdjunto(session, adjuntoPrevio.id);
  }
  return services.ddMatrizEvaluacion.registrarAdjunto(session, {
    vinculoId,
    categoria: categoriaAdjunto,
    nombre: captura.nombre,
    url: urlArchivo,
    mimeType: captura.mimeType,
    tamano: captura.bytes.byteLength,
  });
}

async function avisarTermino(job: Job): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;
  try {
    await pusher.trigger(job.canal, DD_AUTOMATIZACION_EVENTO, publico(job));
  } catch (error) {
    console.warn("[dd-automatizacion] no se pudo enviar el aviso push", error);
  }
}

function publico(job: Job): DdMatrizAutomatizacionDTO {
  return {
    jobId: job.jobId,
    vinculoId: job.vinculoId,
    vinculoNombre: job.vinculoNombre,
    estado: job.estado,
    total: job.total,
    procesados: job.procesados,
    criterios: job.criterios.map((criterio) => ({ ...criterio })),
    canal: job.canal,
  };
}

async function ejecutar(job: Job, session: DdSession): Promise<void> {
  for (const criterio of job.criterios) {
    try {
      await automatizarCriterio(session, job.vinculoId, criterio.codigo);
      criterio.estado = "ok";
    } catch (error) {
      criterio.estado = "error";
      criterio.mensaje = error instanceof Error ? error.message : "No se pudo automatizar";
    }
    job.procesados += 1;
  }
  job.estado = job.criterios.some((criterio) => criterio.estado === "error")
    ? DD_AUTOMATIZACION_ESTADOS.CON_ERRORES
    : DD_AUTOMATIZACION_ESTADOS.COMPLETADA;
  await avisarTermino(job);
}

/**
 * Inicia en segundo plano la automatizacion de TODOS los criterios automatizables del
 * vinculo. Responde de inmediato; el avance se consulta con `estadoAutomatizacion` y el
 * termino se avisa por Pusher al canal privado del usuario.
 */
export async function iniciarAutomatizacionGeneral(
  session: DdSession,
  usuarioId: string,
  vinculoId: string,
): Promise<DdMatrizAutomatizacionDTO> {
  limpiarVencidos();
  const enCurso = [...jobs.values()].find(
    (job) =>
      job.usuarioId === usuarioId &&
      job.vinculoId === vinculoId &&
      job.estado === DD_AUTOMATIZACION_ESTADOS.EN_CURSO,
  );
  if (enCurso) return publico(enCurso);

  const detalle = await services.ddMatrizEvaluacion.detalle(session, vinculoId);
  const criterios: DdMatrizAutomatizacionCriterioDTO[] = listasAplicables(
    detalle.vinculo.tipo,
    detalle.vinculo.ambito,
    detalle.vinculo.tipoDocumento,
  )
    .filter(
      (lista) =>
        lista.codigo !== DD_MATRIZ_LISTA_OTROS &&
        fuenteAutomatizable(lista.codigo) &&
        urlFuenteLista(lista.codigo, detalle.vinculo.nombre, detalle.vinculo.documento),
    )
    .map((lista) => ({ codigo: lista.codigo, label: lista.label, estado: "pendiente", mensaje: null }));
  if (criterios.length === 0) {
    throw new DomainError(
      "Este vínculo no tiene criterios que se puedan automatizar",
      API_ERROR_CODES.VALIDATION,
      422,
    );
  }

  const job: Job = {
    jobId: randomUUID(),
    vinculoId,
    vinculoNombre: detalle.vinculo.nombre,
    estado: DD_AUTOMATIZACION_ESTADOS.EN_CURSO,
    total: criterios.length,
    procesados: 0,
    criterios,
    canal: canalUsuario(usuarioId),
    usuarioId,
    creadoEn: Date.now(),
  };
  jobs.set(job.jobId, job);
  void ejecutar(job, session).catch((error) => {
    job.estado = DD_AUTOMATIZACION_ESTADOS.CON_ERRORES;
    console.error("[dd-automatizacion] fallo inesperado", error);
  });
  return publico(job);
}

export function estadoAutomatizacion(usuarioId: string, jobId: string): DdMatrizAutomatizacionDTO | null {
  const job = jobs.get(jobId);
  return job && job.usuarioId === usuarioId ? publico(job) : null;
}
