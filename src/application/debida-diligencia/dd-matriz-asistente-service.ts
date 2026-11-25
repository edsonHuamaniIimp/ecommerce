import { DomainError } from "@/domain/errors/domain-error";
import type { DdMatrizAdjuntoEntity } from "@/domain/models/dd-matriz-evaluacion";
import type {
  DdAsistenteArchivoIa,
  DdAsistenteSolicitudIa,
  DdAsistenteTextoIa,
  IDdAsistenteIaClient,
} from "@/domain/ports/dd-asistente-ia-client";
import type { IDdConfiguracionRepository } from "@/domain/ports/dd-configuracion-repository";
import type { IDdMatrizEvaluacionRepository } from "@/domain/ports/dd-matriz-evaluacion-repository";
import { CONFIG_DEFAULT } from "@/application/debida-diligencia/dd-configuracion-service";
import type { IDocumentoOrigen } from "@/domain/ports/documento-origen";
import type { IExtractorTexto } from "@/domain/ports/extractor-texto";
import type { DdSession } from "@/application/debida-diligencia/debida-diligencia-service";
import type {
  DdMatrizAsistenteEvidenciaDTO,
  DdMatrizAsistenteRequestDTO,
  DdMatrizAsistenteResponseDTO,
} from "@/types/dto/debida-diligencia";
import {
  API_ERROR_CODES,
  DD_ASISTENTE,
  DD_ASISTENTE_MENSAJES,
  DD_ASISTENTE_METODO_TEXTO_LABELS,
  DD_ASISTENTE_METODOS_TEXTO,
  DD_ASISTENTE_MIME,
  DD_ASISTENTE_MODO_LABELS,
  DD_ASISTENTE_MODOS,
  DD_MATRIZ_CRITERIO_PREFIJO,
  DD_MATRIZ_LISTA_DESCRIPCIONES,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  PERMISSIONS,
} from "@/lib/shared/constants";
import { ddAsistenteUtils } from "@/lib/shared/utils/dd-asistente";
import { limiteObservacionLista, listasAplicables } from "@/lib/shared/utils/dd-matriz-evaluacion";
import { tienePermiso } from "@/lib/shared/utils/permisos";

type RepoAsistente = Pick<IDdMatrizEvaluacionRepository, "findVinculo" | "listarAdjuntos" | "registrarAuditoria">;

interface EvidenciaLeida {
  adjunto: DdMatrizAdjuntoEntity;
  mime: string;
  bytes: Uint8Array;
}

/**
 * Asistente de la observacion del criterio (editor del vinculo, solo SIG). Redacta un texto
 * a partir de la evidencia del criterio y la indicacion del usuario:
 * - Modo IA: el PDF o la imagen se envian completos a la IA.
 * - Modo OCR: el servidor extrae el texto (capa de texto u OCR) y la IA solo recibe ese texto.
 * No guarda nada: el texto vuelve al formulario y SIG decide si lo guarda.
 */
export class DdMatrizAsistenteApplicationService {
  constructor(
    private readonly repo: RepoAsistente,
    private readonly documentos: IDocumentoOrigen,
    private readonly ia: IDdAsistenteIaClient,
    private readonly extractor: IExtractorTexto,
    /** Regla «Asistente IA en observaciones» (Configuración DD). Sin repositorio no se restringe. */
    private readonly configuracion?: Pick<IDdConfiguracionRepository, "obtener">,
  ) {}

  async generar(session: DdSession, dto: DdMatrizAsistenteRequestDTO): Promise<DdMatrizAsistenteResponseDTO> {
    if (!tienePermiso(session, PERMISSIONS.DD_MATRIZ) || !tienePermiso(session, PERMISSIONS.DD_REVISION)) {
      throw new DomainError(DD_ASISTENTE_MENSAJES.SIN_PERMISO, API_ERROR_CODES.FORBIDDEN, 403);
    }
    if (this.configuracion) {
      const config = (await this.configuracion.obtener()) ?? CONFIG_DEFAULT;
      if (!config.asistenteIaHabilitado) {
        throw new DomainError(DD_ASISTENTE_MENSAJES.DESHABILITADO, API_ERROR_CODES.FORBIDDEN, 403);
      }
    }
    if (!ddAsistenteUtils.criterioHabilitado(dto.codigo)) {
      throw new DomainError(DD_ASISTENTE_MENSAJES.CRITERIO_NO_HABILITADO, API_ERROR_CODES.VALIDATION, 400);
    }

    const vinculo = await this.repo.findVinculo(dto.vinculoId);
    if (!vinculo) throw new DomainError("Vínculo no encontrado", API_ERROR_CODES.NOT_FOUND, 404);
    const criterio = listasAplicables(vinculo.tipo, vinculo.ambito, vinculo.tipoDocumento).find(
      (lista) => lista.codigo === dto.codigo,
    );
    if (!criterio) throw new DomainError(DD_ASISTENTE_MENSAJES.CRITERIO_NO_APLICA, API_ERROR_CODES.VALIDATION, 400);

    const elegidos = await this.evidenciasElegidas(vinculo.id, dto);
    if (!this.ia.disponible()) {
      throw new DomainError(DD_ASISTENTE_MENSAJES.IA_NO_DISPONIBLE, API_ERROR_CODES.SERVICE_UNAVAILABLE, 503);
    }
    const ocr = dto.modo === DD_ASISTENTE_MODOS.OCR;
    const requiereOcr = ocr && elegidos.some((e) => e.mime !== DD_ASISTENTE_MIME.DOCX);
    if (requiereOcr && !(await this.extractor.ocrDisponible())) {
      throw new DomainError(DD_ASISTENTE_MENSAJES.OCR_NO_DISPONIBLE, API_ERROR_CODES.SERVICE_UNAVAILABLE, 503);
    }

    const leidos = await Promise.all(
      elegidos.map(async (e): Promise<EvidenciaLeida> => ({ ...e, bytes: (await this.documentos.leer(e.adjunto.url)).bytes })),
    );
    const { archivos, textos, evidencias, textoTruncado } = ocr
      ? await this.prepararOcr(leidos)
      : await this.prepararIa(leidos);

    const limite = limiteObservacionLista(dto.codigo);
    const solicitudIa: DdAsistenteSolicitudIa = {
      instrucciones: ddAsistenteUtils.instrucciones({
        textoDeOcr: evidencias.some((evidencia) => evidencia.metodo === DD_ASISTENTE_METODOS_TEXTO.OCR),
        criterio: criterio.label,
        descripcion: DD_MATRIZ_LISTA_DESCRIPCIONES[criterio.codigo] ?? null,
        vinculo: {
          nombre: vinculo.nombre,
          tipo: DD_MATRIZ_TIPO_VINCULO_LABELS[vinculo.tipo],
          documento: vinculo.documento,
        },
        limite,
      }),
      prompt: dto.prompt,
      archivos,
      textos,
      timeoutMs: archivos.length > 0 ? DD_ASISTENTE.TIMEOUT_IA_ARCHIVOS_MS : DD_ASISTENTE.TIMEOUT_IA_TEXTO_MS,
    };
    const respuesta = await this.ia.generar(solicitudIa).catch((err: unknown) => {
      /* Tiempo agotado o red caida del proveedor: mensaje claro en lugar del error tecnico. */
      if (err instanceof DomainError) throw err;
      throw new DomainError(DD_ASISTENTE_MENSAJES.IA_SATURADA, API_ERROR_CODES.SERVICE_UNAVAILABLE, 503);
    });
    const limpio = ddAsistenteUtils.limpiarRespuesta(respuesta?.texto ?? "");
    if (!limpio) throw new DomainError(DD_ASISTENTE_MENSAJES.SIN_RESPUESTA, API_ERROR_CODES.BAD_GATEWAY, 502);
    const final = ddAsistenteUtils.recortar(limpio, limite);

    await this.repo.registrarAuditoria(
      DD_ASISTENTE.ACCION_AUDITORIA,
      vinculo.expediente.codigo,
      session.email,
      `Matriz DD: asistente "${DD_ASISTENTE_MODO_LABELS[dto.modo]}" en ${criterio.label} de ${vinculo.nombre} ` +
        `con ${elegidos.map((e) => e.adjunto.nombre).join(", ")} (${respuesta?.modelo}).`,
    );

    return { texto: final.texto, modo: dto.modo, evidencias, textoTruncado, recortado: final.recortado };
  }

  /** Evidencias del criterio elegidas por el usuario, con tipo y tamano validados. */
  private async evidenciasElegidas(
    vinculoId: string,
    dto: DdMatrizAsistenteRequestDTO,
  ): Promise<{ adjunto: DdMatrizAdjuntoEntity; mime: string }[]> {
    const categoria = `${DD_MATRIZ_CRITERIO_PREFIJO}${dto.codigo}`;
    const delCriterio = (await this.repo.listarAdjuntos(vinculoId)).filter((adjunto) => adjunto.categoria === categoria);
    if (delCriterio.length === 0) {
      throw new DomainError(DD_ASISTENTE_MENSAJES.SIN_EVIDENCIA, API_ERROR_CODES.VALIDATION, 400);
    }
    const elegidos = [...new Set(dto.adjuntoIds)].map((id) => delCriterio.find((adjunto) => adjunto.id === id));
    if (elegidos.length === 0 || elegidos.some((adjunto) => !adjunto)) {
      throw new DomainError(DD_ASISTENTE_MENSAJES.EVIDENCIA_AJENA, API_ERROR_CODES.VALIDATION, 400);
    }
    const adjuntos = elegidos as DdMatrizAdjuntoEntity[];
    if (adjuntos.reduce((total, adjunto) => total + adjunto.tamano, 0) > DD_ASISTENTE.BYTES_MAX) {
      throw new DomainError(DD_ASISTENTE_MENSAJES.TAMANO_EXCEDIDO, API_ERROR_CODES.VALIDATION, 400);
    }
    return adjuntos.map((adjunto) => {
      const mime = ddAsistenteUtils.mimeSoportado(adjunto.mimeType, adjunto.nombre);
      if (!mime) throw new DomainError(DD_ASISTENTE_MENSAJES.FORMATO_NO_SOPORTADO, API_ERROR_CODES.VALIDATION, 400);
      return { adjunto, mime };
    });
  }

  /** Modo IA: PDF e imagenes van completos; el Word va como texto (la IA no lo lee directo). */
  private async prepararIa(leidos: EvidenciaLeida[]) {
    const archivos: DdAsistenteArchivoIa[] = [];
    const textos: DdAsistenteTextoIa[] = [];
    const evidencias: DdMatrizAsistenteEvidenciaDTO[] = [];
    for (const { adjunto, mime, bytes } of leidos) {
      if (ddAsistenteUtils.esArchivoParaIa(mime)) {
        archivos.push({ nombre: adjunto.nombre, mimeType: mime, bytes });
        evidencias.push({ id: adjunto.id, nombre: adjunto.nombre, metodo: null, paginas: null });
        continue;
      }
      const extraido = await this.extractor.extraer(
        { bytes, mimeType: mime, fileName: adjunto.nombre },
        { maxPaginas: DD_ASISTENTE.OCR_PAGINAS_MAX, timeoutMs: DD_ASISTENTE.TIMEOUT_OCR_MS },
      );
      textos.push({
        nombre: adjunto.nombre,
        texto: ddAsistenteUtils.textoConEncabezado(adjunto.nombre, DD_ASISTENTE_METODO_TEXTO_LABELS[extraido.metodo], extraido.texto),
      });
      evidencias.push({ id: adjunto.id, nombre: adjunto.nombre, metodo: extraido.metodo, paginas: extraido.paginas });
    }
    const unido = ddAsistenteUtils.recortar(textos.map((t) => t.texto).join("\n\n"), DD_ASISTENTE.TEXTO_MAX);
    return {
      archivos,
      textos: unido.texto ? [{ nombre: textos.map((t) => t.nombre).join(", "), texto: unido.texto }] : [],
      evidencias,
      textoTruncado: unido.recortado,
    };
  }

  /** Modo OCR: el servidor extrae el texto de cada evidencia y solo ese texto va a la IA. */
  private async prepararOcr(leidos: EvidenciaLeida[]) {
    /* El tiempo del OCR se reparte entre las evidencias para no pasar el limite de la peticion. */
    const vence = Date.now() + DD_ASISTENTE.TIMEOUT_OCR_MS;
    const partes: string[] = [];
    const evidencias: DdMatrizAsistenteEvidenciaDTO[] = [];
    for (const { adjunto, mime, bytes } of leidos) {
      const restante = vence - Date.now();
      if (restante <= 0) break;
      const extraido = await this.extractor
        .extraer(
          { bytes, mimeType: mime, fileName: adjunto.nombre },
          { maxPaginas: DD_ASISTENTE.OCR_PAGINAS_MAX, timeoutMs: restante },
        )
        .catch(() => null);
      evidencias.push({
        id: adjunto.id,
        nombre: adjunto.nombre,
        metodo: extraido?.metodo ?? null,
        paginas: extraido?.paginas ?? null,
      });
      if (extraido?.texto.trim()) {
        partes.push(
          ddAsistenteUtils.textoConEncabezado(adjunto.nombre, DD_ASISTENTE_METODO_TEXTO_LABELS[extraido.metodo], extraido.texto),
        );
      }
    }
    if (partes.length === 0) {
      throw new DomainError(DD_ASISTENTE_MENSAJES.SIN_TEXTO, API_ERROR_CODES.VALIDATION, 422);
    }
    const unido = ddAsistenteUtils.recortar(partes.join("\n\n"), DD_ASISTENTE.TEXTO_MAX);
    return {
      archivos: [] as DdAsistenteArchivoIa[],
      textos: [{ nombre: evidencias.map((e) => e.nombre).join(", "), texto: unido.texto }],
      evidencias,
      textoTruncado: unido.recortado,
    };
  }
}
