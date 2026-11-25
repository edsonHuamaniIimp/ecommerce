import { DomainError } from "@/domain/errors/domain-error";
import type {
  DdMatrizListasObservacion,
  DdMatrizAdjuntoEntity,
  DdMatrizBloque,
  DdMatrizExportItem,
  DdMatrizResumenEntity,
  DdMatrizFilaEntity,
  DdMatrizListasValor,
  DdMatrizVinculoCambios,
  DdMatrizVinculoEntity,
} from "@/domain/models/dd-matriz-evaluacion";
import type { IDdMatrizEvaluacionRepository } from "@/domain/ports/dd-matriz-evaluacion-repository";
import type { DdSession } from "@/application/debida-diligencia/debida-diligencia-service";
import type {
  DdMatrizEvaluacionExportarRequestDTO,
  DdMatrizEvaluacionGuardarRequestDTO,
  DdMatrizEvaluacionQueryDTO,
  DdMatrizEvaluacionVinculoRequestDTO,
} from "@/types/dto/debida-diligencia";
import {
  API_ERROR_CODES,
  DD_EVENTO_TODOS,
  DD_MATRIZ_ADJUNTO_CATEGORIAS,
  DD_MATRIZ_ADJUNTOS_MAX,
  DD_MATRIZ_AREAS,
  DD_MATRIZ_EXPORT_MAX,
  DD_MATRIZ_FINAL_COMENTARIO_MAX,
  DD_MATRIZ_ORIGENES,
  DD_MATRIZ_PER_PAGE_DEFAULT,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_MATRIZ_TIPOS_VINCULO,
  PERMISSIONS,
  ROLES,
  type DdMatrizAdjuntoCategoria,
  type DdMatrizAmbito,
  type DdMatrizTipoVinculo,
  DD_ACCIONES_LEGAL,
  DD_ESTADOS,
  DD_MENSAJES,
} from "@/lib/shared/constants";
import {
  comunicacionesAprobadas,
  complianceDesbloqueado,
  derivarAmbito,
  evaluarBloqueArea,
  limiteObservacionLista,
  listasAplicables,
  normalizarSiNoNa,
  normalizarResultadoFinal,
  normalizarTextoMatriz,
  resolverPais,
  resultadoFinalEditable,
} from "@/lib/shared/utils/dd-matriz-evaluacion";
import { paisDeTexto } from "@/lib/shared/utils/pais";

/** Que puede hacer una sesion sobre un vinculo concreto. */
export interface DdMatrizPermisos {
  editarIdentidad: boolean;
  editarGenerales: boolean;
  editarListas: boolean;
  editarSig: boolean;
  editarReputacional: boolean;
  editarConclusionReputacional: boolean;
  editarCompliance: boolean;
  editarFinal: boolean;
  complianceDesbloqueado: boolean;
  puedeEliminar: boolean;
}

export interface DdMatrizListarResultado {
  data: DdMatrizFilaEntity[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  paises: { pais: string; total: number }[];
  nuevas: number;
}

export interface DdMatrizDetalleResultado {
  vinculo: DdMatrizVinculoEntity;
  /** Vinculo de tipo empresa del mismo expediente: aporta los datos generales. */
  empresa: DdMatrizVinculoEntity | null;
  adjuntos: DdMatrizAdjuntoEntity[];
  permisos: DdMatrizPermisos;
}

export interface DdMatrizAdjuntoNuevo {
  vinculoId: string;
  categoria: DdMatrizAdjuntoCategoria;
  nombre: string;
  url: string;
  mimeType: string;
  tamano: number;
}

/**
 * Casos de uso de la Matriz de evaluacion DD. Es un registro por vinculo
 * (empresa/persona): no modifica el estado del expediente ni el acceso a reservas.
 * Cada area (SIG, Reputacional, Compliance) edita solo su seccion segun su permiso.
 */
export type DdMatrizAprobarExpediente = (
  expedienteId: string,
  session: DdSession,
) => Promise<void>;

/** Informes DD y Centro documental consultan la matriz solo para leer (lista, detalle y abrir). */
const ACCESO_LECTURA = [PERMISSIONS.DD_INFORMES, PERMISSIONS.DD_REPOSITORIO] as const;
/** El Centro documental ademas carga y elimina evidencias. */
const ACCESO_ADJUNTOS = [PERMISSIONS.DD_REPOSITORIO] as const;

export class DdMatrizEvaluacionApplicationService {
  constructor(
    private readonly repo: IDdMatrizEvaluacionRepository,
    private readonly aprobarExpediente?: DdMatrizAprobarExpediente,
    private readonly cerrarSinRespuesta?: DdMatrizAprobarExpediente,
  ) {}

  private tienePermiso(session: DdSession, permiso: string): boolean {
    return session.roles.includes(ROLES.ADMIN) || session.permissions.includes(permiso);
  }

  /** Acceso a la matriz: el permiso propio o uno de los alternos (Informes / Centro documental leen sus datos). */
  private exigirAcceso(session: DdSession, alternos: readonly string[] = []): void {
    if (
      !this.tienePermiso(session, PERMISSIONS.DD_MATRIZ) &&
      !alternos.some((permiso) => this.tienePermiso(session, permiso))
    ) {
      throw new DomainError("Sin permiso para acceder a la Matriz DD", API_ERROR_CODES.FORBIDDEN, 403);
    }
  }

  private eventoRequerido(session: DdSession): string {
    if (!session.eventoId) {
      throw new DomainError("Selecciona un evento activo para continuar", API_ERROR_CODES.VALIDATION, 400);
    }
    return session.eventoId;
  }

  /** `todos` o vacio = transversal; sin filtro explicito conserva el evento activo. */
  private eventoFiltro(session: DdSession, eventoId?: string): string | undefined {
    const valor = eventoId?.trim();
    if (valor === DD_EVENTO_TODOS) return undefined;
    return valor || this.eventoRequerido(session);
  }

  private calcularPermisos(
    session: DdSession,
    vinculo: DdMatrizVinculoEntity,
    adjuntos: DdMatrizAdjuntoEntity[],
  ): DdMatrizPermisos {
    const sig = this.tienePermiso(session, PERMISSIONS.DD_REVISION);
    const reputacion = this.tienePermiso(session, PERMISSIONS.DD_REPUTACION);
    const legal = this.tienePermiso(session, PERMISSIONS.DD_LEGAL);
    const informes = adjuntos.filter((a) => a.categoria === DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_INFORME).length;
    const desbloqueado = complianceDesbloqueado(vinculo.sig.conclusion, informes);
    return {
      editarIdentidad: sig,
      editarGenerales: sig && vinculo.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA,
      editarListas: sig,
      editarSig: sig,
      editarReputacional: sig,
      /* SIG define el resultado y la conclusion reputacional; Comunicaciones solo observa. */
      editarConclusionReputacional: sig && !reputacion,
      editarCompliance: legal && desbloqueado,
      editarFinal: sig || legal,
      complianceDesbloqueado: desbloqueado,
      puedeEliminar: sig && vinculo.origen === DD_MATRIZ_ORIGENES.MANUAL,
    };
  }

  /** Fecha `YYYY-MM-DD` del formulario a Date (mediodia UTC para no cambiar de dia por zona horaria). */
  private fechaDe(valor: string | null | undefined): Date | null {
    return valor ? new Date(`${valor}T12:00:00.000Z`) : null;
  }

  /** Fecha y responsable de un bloque: lo escrito a mano manda; si no, hoy y quien guarda. */
  private sello(
    entrada: { fecha?: string | null; responsable?: string | null },
    ahora: Date,
    email: string,
  ): Pick<DdMatrizBloque, "fecha" | "responsable"> {
    return {
      fecha: this.fechaDe(entrada.fecha) ?? ahora,
      responsable: entrada.responsable?.trim() || email,
    };
  }

  private prohibido(mensaje: string): never {
    throw new DomainError(mensaje, API_ERROR_CODES.FORBIDDEN, 403);
  }

  private async vinculoRequerido(id: string): Promise<DdMatrizVinculoEntity> {
    const vinculo = await this.repo.findVinculo(id);
    if (!vinculo) throw new DomainError("Vínculo no encontrado", API_ERROR_CODES.NOT_FOUND, 404);
    return vinculo;
  }

  /** Lista paginada; antes sincroniza las filas automaticas con los expedientes del evento. */
  async listar(session: DdSession, query: DdMatrizEvaluacionQueryDTO): Promise<DdMatrizListarResultado> {
    this.exigirAcceso(session, ACCESO_LECTURA);
    const eventoId = this.eventoFiltro(session, query.eventoId);
    const nuevas = eventoId
      ? await this.repo.sincronizarEvento(eventoId, session.email)
      : await this.repo.sincronizarTodosEventos(session.email);

    const page = Math.max(1, query.page ?? 1);
    const perPage = query.perPage ?? DD_MATRIZ_PER_PAGE_DEFAULT;
    const resultado = await this.repo.listar({
      eventoId,
      expedienteId: query.expedienteId,
      page,
      perPage,
      search: query.search,
      tipo: query.tipo as DdMatrizTipoVinculo | undefined,
      ambito: query.ambito as DdMatrizAmbito | undefined,
      pais: query.pais,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
      sinPais: query.sinPais,
      resultadoFinal: query.resultadoFinal,
      origen: query.origen,
      vigencia: query.vigencia,
      eventoActivoId: session.eventoId ?? undefined,
      sinEvaluar: query.sinEvaluar,
      porEmpresa: query.porEmpresa,
    });
    return {
      data: resultado.data,
      total: resultado.total,
      page,
      perPage,
      totalPages: Math.max(1, Math.ceil(resultado.total / perPage)),
      paises: resultado.paises,
      nuevas,
    };
  }

  /** Indicadores de toda la matriz del evento o de todos los eventos. */
  async resumen(session: DdSession, eventoId?: string): Promise<DdMatrizResumenEntity> {
    this.exigirAcceso(session);
    return this.repo.resumen(this.eventoFiltro(session, eventoId));
  }

  /** Vinculos completos para el Excel de la matriz: los ids elegidos o los filtros de la lista. */
  async exportar(session: DdSession, filtros: DdMatrizEvaluacionExportarRequestDTO): Promise<DdMatrizExportItem[]> {
    this.exigirAcceso(session);
    const eventoId = this.eventoFiltro(session, filtros.eventoId);
    const items = await this.repo.listarParaExportar({
      eventoId,
      ids: filtros.ids,
      search: filtros.search,
      tipo: filtros.tipo as DdMatrizTipoVinculo | undefined,
      ambito: filtros.ambito as DdMatrizAmbito | undefined,
      pais: filtros.pais,
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
      sinPais: filtros.sinPais,
      resultadoFinal: filtros.resultadoFinal,
      origen: filtros.origen,
      vigencia: filtros.vigencia,
      eventoActivoId: session.eventoId ?? undefined,
      sinEvaluar: filtros.sinEvaluar,
    });
    if (items.length > DD_MATRIZ_EXPORT_MAX) {
      throw new DomainError(
        `La exportación supera el máximo de ${DD_MATRIZ_EXPORT_MAX} vínculos: acota los filtros`,
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    await this.repo.registrarAuditoria(
      "matriz_exportar",
      eventoId ?? "todos",
      session.email,
      `Matriz DD: exportación de ${items.length} vínculo(s)${filtros.ids ? " (selección)" : ""}`,
    );
    return items;
  }

  /**
   * Id de la fila de la empresa de un expediente, para abrir su detalle desde la
   * Bandeja o el Panel. Sincroniza primero: la fila puede no existir aun.
   */
  async vinculoEmpresaDeExpediente(session: DdSession, expedienteId: string): Promise<string> {
    this.exigirAcceso(session, ACCESO_LECTURA);
    /* La bandeja puede estar en "Todos los eventos": sincroniza el evento del
     * expediente, no el evento activo de la sesion. */
    const eventoId = await this.repo.findEventoIdDeExpediente(expedienteId);
    if (!eventoId) {
      throw new DomainError(
        "El expediente aún no está en la matriz (debe haber sido enviado a revisión)",
        API_ERROR_CODES.NOT_FOUND,
        404,
      );
    }
    await this.repo.sincronizarEvento(eventoId, session.email);
    const empresa = await this.repo.findVinculoEmpresa(expedienteId);
    if (!empresa) {
      throw new DomainError(
        "El expediente aún no está en la matriz (debe haber sido enviado a revisión)",
        API_ERROR_CODES.NOT_FOUND,
        404,
      );
    }
    return empresa.id;
  }

  async detalle(session: DdSession, id: string): Promise<DdMatrizDetalleResultado> {
    this.exigirAcceso(session, ACCESO_LECTURA);
    const vinculo = await this.vinculoRequerido(id);
    const [adjuntos, empresa] = await Promise.all([
      this.repo.listarAdjuntos(id),
      vinculo.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA
        ? Promise.resolve(vinculo)
        : this.repo.findVinculoEmpresa(vinculo.expediente.expedienteId),
    ]);
    return { vinculo, empresa, adjuntos, permisos: this.calcularPermisos(session, vinculo, adjuntos) };
  }

  /** Aplica las secciones presentes del request, cada una con el permiso de su area. */
  async guardar(session: DdSession, dto: DdMatrizEvaluacionGuardarRequestDTO): Promise<DdMatrizDetalleResultado> {
    this.exigirAcceso(session);
    const vinculo = await this.vinculoRequerido(dto.id);
    const adjuntos = await this.repo.listarAdjuntos(dto.id);
    const permisos = this.calcularPermisos(session, vinculo, adjuntos);
    const ahora = new Date();
    const cambios: DdMatrizVinculoCambios = { actualizadoPor: session.email };
    let reiniciarAutomatico = false;

    if (dto.borrador) return this.guardarBorrador(session, dto, vinculo, permisos);

    if (dto.identidad) {
      if (!permisos.editarIdentidad) this.prohibido("Sin permiso para editar los datos del vínculo");
      const { ambito, pais, ...datos } = dto.identidad;
      const completaIdentidad = Object.values(datos).some((v) => v !== undefined);
      /* En filas automaticas lo que SIG completa o corrige se conserva: la sincronizacion no lo pisa. */
      if (completaIdentidad && vinculo.origen === DD_MATRIZ_ORIGENES.AUTOMATICO) cambios.identidadEditada = true;
      if (datos.nombre !== undefined) cambios.nombre = datos.nombre.trim();
      if (datos.tipoDocumento !== undefined) cambios.tipoDocumento = datos.tipoDocumento?.trim() || null;
      if (datos.documento !== undefined) cambios.documento = datos.documento?.trim() || null;
      if (datos.nacionalidad !== undefined) cambios.nacionalidad = datos.nacionalidad?.trim() || null;
      if (datos.cargo !== undefined) cambios.cargo = datos.cargo?.trim() || null;
      if (pais !== undefined) {
        if (normalizarTextoMatriz(pais) === "") {
          /* Vacio: vuelve al valor automatico. Las filas del expediente se recalculan con
           * la sincronizacion; las manuales lo derivan de su nacionalidad. */
          cambios.paisEditado = false;
          cambios.ambitoEditado = false;
          reiniciarAutomatico = vinculo.origen === DD_MATRIZ_ORIGENES.AUTOMATICO;
          if (!reiniciarAutomatico) {
            cambios.pais = resolverPais({ nacionalidad: vinculo.nacionalidad });
            cambios.ambito = derivarAmbito({ paisIso: cambios.pais, tipoDocumento: vinculo.tipoDocumento });
          }
        } else {
          const iso = paisDeTexto(pais);
          if (!iso) throw new DomainError("País no reconocido: usa el código ISO o el nombre", API_ERROR_CODES.VALIDATION, 400);
          cambios.pais = iso;
          cambios.paisEditado = true;
          /* El pais decide el ambito, salvo que el mismo request lo fije explicitamente. */
          if (ambito === undefined) {
            cambios.ambito = derivarAmbito({ paisIso: iso, tipoDocumento: vinculo.tipoDocumento });
            cambios.ambitoEditado = false;
          }
        }
      }
      if (ambito !== undefined) {
        cambios.ambito = ambito as DdMatrizAmbito;
        cambios.ambitoEditado = true;
      }
    }

    if (dto.generales) {
      if (!permisos.editarGenerales) this.prohibido("Los datos generales solo se editan en la fila de la empresa");
      cambios.generales = this.mapearGenerales(dto.generales);
    }

    const ambitoEfectivo = (cambios.ambito ?? vinculo.ambito) as DdMatrizAmbito;

    if (dto.listas) {
      if (!permisos.editarListas) this.prohibido("Sin permiso para registrar las listas restrictivas");
      cambios.listas = this.mapearListas(dto.listas, vinculo, ambitoEfectivo);
    }

    if (dto.listasObservaciones) {
      if (!permisos.editarListas) this.prohibido("Sin permiso para registrar las observaciones de los criterios");
      cambios.listasObservaciones = this.mapearListasObservaciones(dto.listasObservaciones, vinculo, ambitoEfectivo);
    }

    if (dto.sig) {
      if (!permisos.editarSig) this.prohibido("Sin permiso para registrar la evaluación de SIG");
      const evaluado = this.evaluar(DD_MATRIZ_AREAS.SIG, vinculo.sig, dto.sig);
      cambios.sig = { ...evaluado, ...this.sello(dto.sig, ahora, session.email) };
    }

    if (dto.reputacional) {
      if (permisos.editarReputacional) {
        const evaluado = this.evaluar(DD_MATRIZ_AREAS.REPUTACIONAL, vinculo.reputacional, dto.reputacional);
        cambios.reputacional = { ...evaluado, ...this.sello(dto.reputacional, ahora, session.email) };
      } else if (permisos.editarConclusionReputacional) {
        const { resultado, observaciones, conclusion } = dto.reputacional;
        const tocaOtrosCampos =
          (resultado !== undefined && normalizarTextoMatriz(resultado) !== normalizarTextoMatriz(vinculo.reputacional.resultado)) ||
          (observaciones !== undefined && (observaciones ?? "") !== (vinculo.reputacional.observaciones ?? ""));
        if (tocaOtrosCampos) this.prohibido("SIG solo puede actualizar la conclusión reputacional");
        const evaluado = this.evaluar(DD_MATRIZ_AREAS.REPUTACIONAL, vinculo.reputacional, { conclusion });
        cambios.reputacional = { conclusion: evaluado.conclusion };
      } else {
        this.prohibido("Sin permiso para registrar la evaluación reputacional");
      }
    }

    if (dto.compliance) {
      if (!permisos.editarCompliance) {
        this.prohibido(
          permisos.complianceDesbloqueado
            ? "Sin permiso para registrar la evaluación de Compliance"
            : "Compliance se habilita cuando SIG indica REQUIERE DEBIDA DILIGENCIA REFORZADA y adjunta el informe",
        );
      }
      const evaluado = this.evaluar(DD_MATRIZ_AREAS.COMPLIANCE, vinculo.compliance, dto.compliance);
      cambios.compliance = { ...evaluado, ...this.sello(dto.compliance, ahora, session.email) };
    }

    if (
      dto.resultadoFinal !== undefined ||
      dto.finalFecha !== undefined ||
      dto.finalPor !== undefined ||
      dto.finalComentario !== undefined
    ) {
      if (!permisos.editarFinal) this.prohibido("El resultado final lo registra SIG o Compliance");
      if (vinculo.expediente.estado === DD_ESTADOS.DOCUMENTACION_RECIBIDA) {
        throw new DomainError(DD_MENSAJES.REVISION_NO_INICIADA, API_ERROR_CODES.CONFLICT, 409);
      }
      if (normalizarResultadoFinal(dto.resultadoFinal) === DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_RECIBIDA) {
        throw new DomainError("\"Documentación recibida\" se asigna sola cuando el cliente envía; no se registra a mano.", API_ERROR_CODES.VALIDATION, 400);
      }
      if (!resultadoFinalEditable(vinculo.resultadoFinal, vinculo.expediente.estado)) {
        throw new DomainError(
          "El resultado final ya está cerrado; solo se puede modificar cuando el expediente está en revisión o con documentación observada.",
          API_ERROR_CODES.CONFLICT,
          409,
        );
      }
      if (dto.resultadoFinal !== undefined) {
        if (normalizarTextoMatriz(dto.resultadoFinal) === "") {
          cambios.resultadoFinal = null;
          cambios.finalFecha = null;
          cambios.finalPor = null;
          cambios.finalComentario = null;
        } else {
          const final = normalizarResultadoFinal(dto.resultadoFinal);
          if (!final) throw new DomainError("Resultado final no reconocido", API_ERROR_CODES.VALIDATION, 400);
          cambios.resultadoFinal = final;
          cambios.finalFecha = ahora;
          cambios.finalPor = session.email;
        }
      }
      if (dto.finalComentario !== undefined) {
        const comentario = dto.finalComentario?.trim() || null;
        if (comentario && comentario.length > DD_MATRIZ_FINAL_COMENTARIO_MAX) {
          throw new DomainError(
            `El comentario final supera el máximo de ${DD_MATRIZ_FINAL_COMENTARIO_MAX} caracteres`,
            API_ERROR_CODES.VALIDATION,
            400,
          );
        }
        cambios.finalComentario = comentario;
      }
      /* Lo escrito a mano (fecha / quien registra) prevalece sobre el sello automatico. */
      if (dto.finalFecha !== undefined) cambios.finalFecha = this.fechaDe(dto.finalFecha);
      if (dto.finalPor !== undefined) cambios.finalPor = dto.finalPor?.trim() || null;

      const finalEfectivo =
        cambios.resultadoFinal !== undefined ? cambios.resultadoFinal : vinculo.resultadoFinal;
      const comentarioEfectivo =
        cambios.finalComentario !== undefined ? cambios.finalComentario : vinculo.finalComentario;
      const requiereComentarioInterno =
        finalEfectivo !== DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA;
      if (
        (dto.resultadoFinal !== undefined || dto.finalComentario !== undefined) &&
        finalEfectivo &&
        requiereComentarioInterno &&
        !comentarioEfectivo?.trim()
      ) {
        throw new DomainError(
          "El resultado final requiere un comentario interno de sustento",
          API_ERROR_CODES.VALIDATION,
          400,
        );
      }
      if (
        dto.resultadoFinal !== undefined &&
        finalEfectivo === DD_MATRIZ_RESULTADOS_FINALES.APTO
      ) {
        await this.validarComunicacionesParaApto(
          {
            ...vinculo,
            reputacional: cambios.reputacional
              ? { ...vinculo.reputacional, ...cambios.reputacional }
              : vinculo.reputacional,
          },
          { omitir: dto.omitirValidacionComunicaciones === true, usuario: session.email },
        );
      }
    }

    let actualizado = await this.repo.actualizarVinculo(dto.id, cambios);
    if (reiniciarAutomatico && session.eventoId) {
      await this.repo.sincronizarEvento(session.eventoId, session.email);
      actualizado = (await this.repo.findVinculo(dto.id)) ?? actualizado;
    }
    await this.repo.registrarAuditoria(
      "matriz_guardar",
      vinculo.expediente.codigo,
      session.email,
      `Matriz DD: se actualizó ${vinculo.nombre} (${Object.keys(dto).filter((k) => k !== "id").join(", ") || "sin cambios"})`,
    );
    await this.repo.iniciarRevisionSiRecibida(vinculo.expediente.expedienteId, session.email, `Guardó la evaluación del vínculo ${vinculo.nombre} en la Matriz DD.`);

    await this.cerrarEmpresaSiTodosAptos(actualizado, session);

    let empresa =
      actualizado.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA
        ? ((await this.repo.findVinculo(actualizado.id)) ?? actualizado)
        : await this.repo.findVinculoEmpresa(actualizado.expediente.expedienteId);
    if (empresa?.resultadoFinal === DD_MATRIZ_RESULTADOS_FINALES.APTO) {
      await this.aprobarExpediente?.(actualizado.expediente.expedienteId, session);
      /* El puente cambia el estado del expediente: refrescar para no devolver
       * una respuesta con el estado anterior al APTO. */
      actualizado = (await this.repo.findVinculo(actualizado.id)) ?? actualizado;
      empresa =
        actualizado.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA
          ? ((await this.repo.findVinculo(actualizado.id)) ?? actualizado)
          : await this.repo.findVinculoEmpresa(actualizado.expediente.expedienteId);
    }
    if (empresa?.resultadoFinal === DD_MATRIZ_RESULTADOS_FINALES.SIN_RESPUESTA) {
      await this.cerrarSinRespuesta?.(actualizado.expediente.expedienteId, session);
    }
    const vinculoFinal = actualizado.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA
      ? (empresa ?? actualizado)
      : actualizado;
    return {
      vinculo: vinculoFinal,
      empresa,
      adjuntos,
      permisos: this.calcularPermisos(session, vinculoFinal, adjuntos),
    };
  }

  /**
   * Bloquea el APTO si Comunicaciones no cerró sin hallazgos.
   * En la fila de empresa se exige el veredicto de todos los vínculos.
   */
  private async validarComunicacionesParaApto(
    vinculo: DdMatrizVinculoEntity,
    bypass: { omitir: boolean; usuario: string } = { omitir: false, usuario: "" },
  ): Promise<void> {
    /* El dictamen de Legal (aprobar) prevalece sobre los hallazgos de Comunicaciones: SIG puede cerrar APTO. */
    if (vinculo.expediente.decisionLegal === DD_ACCIONES_LEGAL.APROBAR) return;
    const vinculos =
      vinculo.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA
        ? await this.repo.listarVinculosExpediente(vinculo.expediente.expedienteId)
        : [vinculo];
    const pendientes = vinculos.filter((item) => !comunicacionesAprobadas(item.reputacional.resultado, item.reputacional.conclusion));
    if (pendientes.length === 0) return;

    const detalle = pendientes
      .map((item) => {
        const tipo =
          DD_MATRIZ_TIPO_VINCULO_LABELS[
            item.tipo as keyof typeof DD_MATRIZ_TIPO_VINCULO_LABELS
          ] ?? item.tipo;
        return `${item.nombre} (${tipo})`;
      })
      .join(", ");
    if (bypass.omitir) {
      await this.repo.registrarAuditoria(
        "matriz_bypass_comunicaciones",
        vinculo.expediente.codigo,
        bypass.usuario,
        `Matriz DD: APTO declarado sin veredicto de Comunicaciones sin hallazgos para: ${detalle}`,
      );
      return;
    }
    throw new DomainError(
      `No se puede declarar APTO: Comunicaciones no tiene un veredicto sin hallazgos para: ${detalle}`,
      API_ERROR_CODES.CONFLICT,
      409,
    );
  }

  /**
   * Si el ultimo vínculo evaluado completa el expediente y todos quedaron APTO,
   * registra automaticamente la conclusión final APTO en la fila de la empresa.
   * Un final manual distinto se conserva.
   */
  private async cerrarEmpresaSiTodosAptos(
    actualizado: DdMatrizVinculoEntity,
    session: DdSession,
  ): Promise<void> {
    if (actualizado.resultadoFinal !== DD_MATRIZ_RESULTADOS_FINALES.APTO) return;

    const vinculos = await this.repo.listarVinculosExpediente(actualizado.expediente.expedienteId);
    if (vinculos.length === 0) return;

    const empresa = vinculos.find((item) => item.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA);
    if (!empresa) return;
    if (empresa.resultadoFinal === DD_MATRIZ_RESULTADOS_FINALES.APTO) return;
    if (empresa.resultadoFinal && empresa.resultadoFinal !== DD_MATRIZ_RESULTADOS_FINALES.APTO) return;

    const esApto = (item: DdMatrizVinculoEntity): boolean =>
      item.resultadoFinal
        ? item.resultadoFinal === DD_MATRIZ_RESULTADOS_FINALES.APTO
        : item.sig.resultado === DD_MATRIZ_RESULTADOS.ACEPTADO;
    const todosAptos = vinculos.every(esApto);
    if (!todosAptos) return;
    if (!vinculos.every((item) => comunicacionesAprobadas(item.reputacional.resultado, item.reputacional.conclusion))) return;

    await this.repo.actualizarVinculo(empresa.id, {
      actualizadoPor: session.email,
      resultadoFinal: DD_MATRIZ_RESULTADOS_FINALES.APTO,
      finalFecha: new Date(),
      finalPor: session.email,
      finalComentario: "Cierre automático: todos los vínculos quedaron APTO.",
    });
    await this.repo.registrarAuditoria(
      "matriz_cierre_automatico",
      actualizado.expediente.codigo,
      session.email,
      "Matriz DD: la empresa quedó APTO automáticamente porque todos sus vínculos están APTO.",
    );
  }

  /** Agrega a mano una persona/empresa vinculada a un expediente del evento. */
  async agregarVinculo(
    session: DdSession,
    dto: DdMatrizEvaluacionVinculoRequestDTO,
  ): Promise<DdMatrizDetalleResultado> {
    this.exigirAcceso(session);
    if (!this.tienePermiso(session, PERMISSIONS.DD_REVISION)) {
      this.prohibido("Sin permiso para agregar vínculos");
    }
    if (dto.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA) {
      throw new DomainError("La fila de la empresa se crea automáticamente", API_ERROR_CODES.VALIDATION, 400);
    }
    const eventoId = this.eventoRequerido(session);
    if (!(await this.repo.existeExpedienteEnEvento(dto.expedienteId, eventoId))) {
      throw new DomainError("Expediente no encontrado en el evento activo", API_ERROR_CODES.NOT_FOUND, 404);
    }

    const paisTexto = normalizarTextoMatriz(dto.pais) === "" ? null : paisDeTexto(dto.pais);
    if (normalizarTextoMatriz(dto.pais) !== "" && !paisTexto) {
      throw new DomainError("País no reconocido: usa el código ISO o el nombre", API_ERROR_CODES.VALIDATION, 400);
    }
    const pais = paisTexto ?? resolverPais({ nacionalidad: dto.nacionalidad });
    const ambito =
      (dto.ambito as DdMatrizAmbito | undefined) ??
      derivarAmbito({ paisIso: pais, tipoDocumento: dto.tipoDocumento });
    const creado = await this.repo.crearVinculoManual({
      expedienteId: dto.expedienteId,
      tipo: dto.tipo as DdMatrizTipoVinculo,
      nombre: dto.nombre.trim(),
      tipoDocumento: dto.tipoDocumento?.trim() || null,
      documento: dto.documento?.trim() || null,
      nacionalidad: dto.nacionalidad?.trim() || null,
      cargo: dto.cargo?.trim() || null,
      ambito,
      pais,
      paisEditado: paisTexto !== null,
      creadoPor: session.email,
    });
    await this.repo.registrarAuditoria(
      "matriz_agregar_vinculo",
      creado.expediente.codigo,
      session.email,
      `Matriz DD: se agregó el vínculo ${creado.nombre}`,
    );
    return this.detalle(session, creado.id);
  }

  async eliminarVinculo(session: DdSession, id: string): Promise<void> {
    this.exigirAcceso(session);
    const vinculo = await this.vinculoRequerido(id);
    const adjuntos = await this.repo.listarAdjuntos(id);
    if (!this.calcularPermisos(session, vinculo, adjuntos).puedeEliminar) {
      this.prohibido("Solo se pueden eliminar vínculos agregados manualmente");
    }
    await this.repo.eliminarVinculoManual(id);
    await this.repo.registrarAuditoria(
      "matriz_eliminar_vinculo",
      vinculo.expediente.codigo,
      session.email,
      `Matriz DD: se eliminó el vínculo ${vinculo.nombre}`,
    );
  }

  /** Valida permiso y limite ANTES de subir el archivo a storage (evita huerfanos). */
  async autorizarAdjunto(
    session: DdSession,
    vinculoId: string,
    categoria: DdMatrizAdjuntoCategoria,
  ): Promise<DdMatrizVinculoEntity> {
    this.exigirAcceso(session, ACCESO_ADJUNTOS);
    const vinculo = await this.vinculoRequerido(vinculoId);
    const adjuntos = await this.repo.listarAdjuntos(vinculoId);
    this.exigirPermisoAdjunto(session, vinculo, adjuntos, categoria);
    if (adjuntos.length >= DD_MATRIZ_ADJUNTOS_MAX) {
      throw new DomainError(
        `Máximo ${DD_MATRIZ_ADJUNTOS_MAX} adjuntos por vínculo`,
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    return vinculo;
  }

  /** Registra un adjunto ya subido a storage; el informe de SIG habilita a Compliance. */
  async registrarAdjunto(session: DdSession, datos: DdMatrizAdjuntoNuevo): Promise<DdMatrizAdjuntoEntity> {
    const vinculo = await this.autorizarAdjunto(session, datos.vinculoId, datos.categoria);
    const adjunto = await this.repo.crearAdjunto({ ...datos, creadoPor: session.email });
    await this.repo.registrarAuditoria(
      "matriz_adjunto",
      vinculo.expediente.codigo,
      session.email,
      `Matriz DD: se adjuntó ${datos.nombre} (${datos.categoria}) a ${vinculo.nombre}`,
    );
    await this.repo.iniciarRevisionSiRecibida(vinculo.expediente.expedienteId, session.email, `Adjuntó la evidencia ${datos.nombre} al vínculo ${vinculo.nombre}.`);
    return adjunto;
  }

  async eliminarAdjunto(session: DdSession, id: string): Promise<void> {
    this.exigirAcceso(session, ACCESO_ADJUNTOS);
    const adjunto = await this.repo.findAdjunto(id);
    if (!adjunto) throw new DomainError("Adjunto no encontrado", API_ERROR_CODES.NOT_FOUND, 404);
    const vinculo = await this.vinculoRequerido(adjunto.vinculoId);
    const adjuntos = await this.repo.listarAdjuntos(adjunto.vinculoId);
    this.exigirPermisoAdjunto(session, vinculo, adjuntos, adjunto.categoria, adjunto);
    await this.repo.eliminarAdjunto(id);
    await this.repo.registrarAuditoria(
      "matriz_adjunto_eliminar",
      vinculo.expediente.codigo,
      session.email,
      `Matriz DD: se quitó ${adjunto.nombre} de ${vinculo.nombre}`,
    );
  }

  private exigirPermisoAdjunto(
    session: DdSession,
    vinculo: DdMatrizVinculoEntity,
    adjuntos: DdMatrizAdjuntoEntity[],
    categoria: DdMatrizAdjuntoCategoria,
    existente?: DdMatrizAdjuntoEntity,
  ): void {
    const permisos = this.calcularPermisos(session, vinculo, adjuntos);
    /* Centro documental: carga evidencias de cualquier categoria y elimina solo las que subio. */
    const delCentroDocumental =
      this.tienePermiso(session, PERMISSIONS.DD_REPOSITORIO) &&
      (!existente || existente.creadoPor === session.email);
    const permitidoPorArea =
      categoria === DD_MATRIZ_ADJUNTO_CATEGORIAS.REPUTACIONAL_SUSTENTO
        ? permisos.editarReputacional || permisos.editarConclusionReputacional
        : categoria === DD_MATRIZ_ADJUNTO_CATEGORIAS.COMPLIANCE_SUSTENTO
          ? permisos.editarCompliance || permisos.editarSig
          : permisos.editarSig;
    if (!delCentroDocumental && !permitidoPorArea) this.prohibido("Sin permiso para gestionar este adjunto");
  }

  /** Combina el bloque existente con lo enviado y aplica las reglas del proceso. */
  private evaluar(
    area: (typeof DD_MATRIZ_AREAS)[keyof typeof DD_MATRIZ_AREAS],
    actual: DdMatrizBloque,
    entrada: { resultado?: string | null; observaciones?: string | null; conclusion?: string | null },
  ): Pick<DdMatrizBloque, "resultado" | "observaciones" | "conclusion"> {
    const evaluado = evaluarBloqueArea(area, {
      resultado: entrada.resultado !== undefined ? entrada.resultado : actual.resultado,
      observaciones: entrada.observaciones !== undefined ? entrada.observaciones : actual.observaciones,
      conclusion: entrada.conclusion !== undefined ? entrada.conclusion : actual.conclusion,
    });
    if (evaluado.errores.length > 0) {
      throw new DomainError(evaluado.errores.join(". "), API_ERROR_CODES.VALIDATION, 400);
    }
    return evaluado.valor;
  }

  private mapearGenerales(
    generales: NonNullable<DdMatrizEvaluacionGuardarRequestDTO["generales"]>,
  ): NonNullable<DdMatrizVinculoCambios["generales"]> {
    const resultado: NonNullable<DdMatrizVinculoCambios["generales"]> = {};
    if (generales.fechaInicioActividades !== undefined) {
      resultado.fechaInicioActividades = generales.fechaInicioActividades
        ? new Date(`${generales.fechaInicioActividades}T00:00:00.000Z`)
        : null;
    }
    if (generales.estadoContribuyente !== undefined) {
      resultado.estadoContribuyente = generales.estadoContribuyente?.trim() || null;
    }
    if (generales.direccionLegal !== undefined) resultado.direccionLegal = generales.direccionLegal?.trim() || null;
    if (generales.actividadEconomica !== undefined) {
      resultado.actividadEconomica = generales.actividadEconomica?.trim() || null;
    }
    if (generales.motivo !== undefined) resultado.motivo = generales.motivo?.trim() || null;
    if (generales.eventoProyecto !== undefined) resultado.eventoProyecto = generales.eventoProyecto?.trim() || null;
    for (const campo of ["historialIimp", "beneficioMutuo"] as const) {
      const valor = generales[campo];
      if (valor === undefined) continue;
      if (normalizarTextoMatriz(valor) === "") {
        resultado[campo] = null;
        continue;
      }
      const normalizado = normalizarSiNoNa(valor);
      if (!normalizado) throw new DomainError(`Valor no reconocido en ${campo}`, API_ERROR_CODES.VALIDATION, 400);
      resultado[campo] = normalizado;
    }
    return resultado;
  }

  /**
   * Guardado borrador: criterios, observaciones por criterio y texto de observaciones de SIG, sin
   * resultado ni conclusion, sin sellar fecha/responsable y sin las exigencias de una evaluacion cerrada.
   */
  private async guardarBorrador(
    session: DdSession,
    dto: DdMatrizEvaluacionGuardarRequestDTO,
    vinculo: DdMatrizVinculoEntity,
    permisos: DdMatrizPermisos,
  ): Promise<DdMatrizDetalleResultado> {
    const soloBorrador =
      !dto.identidad &&
      !dto.generales &&
      !dto.reputacional &&
      !dto.compliance &&
      dto.resultadoFinal === undefined &&
      dto.sig?.resultado === undefined &&
      dto.sig?.conclusion === undefined;
    if (!soloBorrador) {
      throw new DomainError(
        "El borrador solo guarda criterios, sus observaciones y las observaciones de SIG",
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    const cambios: DdMatrizVinculoCambios = { actualizadoPor: session.email };
    const ambito = vinculo.ambito as DdMatrizAmbito;

    if (dto.listas) {
      if (!permisos.editarListas) this.prohibido("Sin permiso para registrar las listas restrictivas");
      cambios.listas = this.mapearListas(dto.listas, vinculo, ambito);
    }
    if (dto.listasObservaciones) {
      if (!permisos.editarListas) this.prohibido("Sin permiso para registrar las observaciones de los criterios");
      cambios.listasObservaciones = this.mapearListasObservaciones(dto.listasObservaciones, vinculo, ambito);
    }
    if (dto.sig?.observaciones !== undefined) {
      if (!permisos.editarSig) this.prohibido("Sin permiso para registrar la evaluación de SIG");
      const texto = dto.sig.observaciones?.trim() || null;
      if (!texto && vinculo.sig.resultado === DD_MATRIZ_RESULTADOS.OBSERVADO) {
        throw new DomainError(
          "Una evaluación OBSERVADA exige registrar la observación",
          API_ERROR_CODES.VALIDATION,
          400,
        );
      }
      cambios.sig = { observaciones: texto };
    }

    await this.repo.actualizarVinculo(vinculo.id, cambios);
    await this.repo.registrarAuditoria(
      "matriz_borrador",
      vinculo.expediente.codigo,
      session.email,
      `Matriz DD: borrador guardado en ${vinculo.nombre}`,
    );
    await this.repo.iniciarRevisionSiRecibida(vinculo.expediente.expedienteId, session.email, `Guardó un borrador en el vínculo ${vinculo.nombre} de la Matriz DD.`);
    return this.detalle(session, vinculo.id);
  }

  /** Observacion por criterio: solo criterios aplicables al vinculo; el maximo depende del criterio. */
  private mapearListasObservaciones(
    entrada: Record<string, string | null>,
    vinculo: DdMatrizVinculoEntity,
    ambito: DdMatrizAmbito,
  ): DdMatrizListasObservacion {
    const aplicables = new Set(
      listasAplicables(vinculo.tipo, ambito, vinculo.tipoDocumento).map((l) => l.codigo),
    );
    const resultado: DdMatrizListasObservacion = { ...vinculo.listasObservaciones };
    for (const [codigo, valor] of Object.entries(entrada)) {
      if (!aplicables.has(codigo)) {
        throw new DomainError(`La lista "${codigo}" no aplica a este vínculo`, API_ERROR_CODES.VALIDATION, 400);
      }
      const texto = valor?.trim() ?? "";
      if (texto === "") {
        delete resultado[codigo];
        continue;
      }
      const maximo = limiteObservacionLista(codigo);
      if (texto.length > maximo) {
        throw new DomainError(
          `La observación de "${codigo}" admite hasta ${maximo} caracteres`,
          API_ERROR_CODES.VALIDATION,
          400,
        );
      }
      resultado[codigo] = texto;
    }
    return resultado;
  }

  private mapearListas(
    entrada: Record<string, string | null>,
    vinculo: DdMatrizVinculoEntity,
    ambito: DdMatrizAmbito,
  ): DdMatrizListasValor {
    const aplicables = new Set(
      listasAplicables(vinculo.tipo, ambito, vinculo.tipoDocumento).map((l) => l.codigo),
    );
    const resultado: DdMatrizListasValor = { ...vinculo.listas };
    for (const [codigo, valor] of Object.entries(entrada)) {
      if (!aplicables.has(codigo)) {
        throw new DomainError(`La lista "${codigo}" no aplica a este vínculo`, API_ERROR_CODES.VALIDATION, 400);
      }
      if (normalizarTextoMatriz(valor) === "") {
        delete resultado[codigo];
        continue;
      }
      const normalizado = normalizarSiNoNa(valor);
      if (!normalizado) {
        throw new DomainError(`Respuesta no reconocida en la lista "${codigo}"`, API_ERROR_CODES.VALIDATION, 400);
      }
      resultado[codigo] = normalizado;
    }
    return resultado;
  }
}

