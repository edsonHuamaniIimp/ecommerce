import { DomainError } from "@/domain/errors/domain-error";
import type {
  DdMatrizAdjuntoEntity,
  DdMatrizBloque,
  DdMatrizFilaEntity,
  DdMatrizListasValor,
  DdMatrizVinculoCambios,
  DdMatrizVinculoEntity,
} from "@/domain/models/dd-matriz-evaluacion";
import type { IDdMatrizEvaluacionRepository } from "@/domain/ports/dd-matriz-evaluacion-repository";
import type { DdSession } from "@/application/debida-diligencia/debida-diligencia-service";
import type {
  DdMatrizEvaluacionGuardarRequestDTO,
  DdMatrizEvaluacionQueryDTO,
  DdMatrizEvaluacionVinculoRequestDTO,
} from "@/types/dto/debida-diligencia";
import {
  API_ERROR_CODES,
  DD_MATRIZ_ADJUNTO_CATEGORIAS,
  DD_MATRIZ_ADJUNTOS_MAX,
  DD_MATRIZ_AREAS,
  DD_MATRIZ_ORIGENES,
  DD_MATRIZ_PER_PAGE_DEFAULT,
  DD_MATRIZ_TIPOS_VINCULO,
  PERMISSIONS,
  ROLES,
  type DdMatrizAdjuntoCategoria,
  type DdMatrizAmbito,
  type DdMatrizTipoVinculo,
} from "@/lib/shared/constants";
import {
  complianceDesbloqueado,
  derivarAmbito,
  evaluarBloqueArea,
  listasAplicables,
  normalizarSiNoNa,
  normalizarResultadoFinal,
  normalizarTextoMatriz,
} from "@/lib/shared/utils/dd-matriz-evaluacion";

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
export class DdMatrizEvaluacionApplicationService {
  constructor(private readonly repo: IDdMatrizEvaluacionRepository) {}

  private tienePermiso(session: DdSession, permiso: string): boolean {
    return session.roles.includes(ROLES.ADMIN) || session.permissions.includes(permiso);
  }

  private exigirAcceso(session: DdSession): void {
    if (!this.tienePermiso(session, PERMISSIONS.DD_MATRIZ)) {
      throw new DomainError("Sin permiso para acceder a la Matriz DD", API_ERROR_CODES.FORBIDDEN, 403);
    }
  }

  private eventoRequerido(session: DdSession): string {
    if (!session.eventoId) {
      throw new DomainError("Selecciona un evento activo para continuar", API_ERROR_CODES.VALIDATION, 400);
    }
    return session.eventoId;
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
      editarReputacional: reputacion,
      /* Regla 3: SIG puede ajustar la conclusion reputacional segun las evidencias. */
      editarConclusionReputacional: sig && !reputacion,
      editarCompliance: legal && desbloqueado,
      editarFinal: sig || legal,
      complianceDesbloqueado: desbloqueado,
      puedeEliminar: sig && vinculo.origen === DD_MATRIZ_ORIGENES.MANUAL,
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
    this.exigirAcceso(session);
    const eventoId = this.eventoRequerido(session);
    const nuevas = await this.repo.sincronizarEvento(eventoId, session.email);

    const page = Math.max(1, query.page ?? 1);
    const perPage = query.perPage ?? DD_MATRIZ_PER_PAGE_DEFAULT;
    const resultado = await this.repo.listar({
      eventoId,
      page,
      perPage,
      search: query.search,
      tipo: query.tipo as DdMatrizTipoVinculo | undefined,
      ambito: query.ambito as DdMatrizAmbito | undefined,
      resultadoFinal: query.resultadoFinal,
      sinEvaluar: query.sinEvaluar,
    });
    return {
      data: resultado.data,
      total: resultado.total,
      page,
      perPage,
      totalPages: Math.max(1, Math.ceil(resultado.total / perPage)),
      nuevas,
    };
  }

  /**
   * Id de la fila de la empresa de un expediente, para abrir su detalle desde la
   * Bandeja o el Panel. Sincroniza primero: la fila puede no existir aun.
   */
  async vinculoEmpresaDeExpediente(session: DdSession, expedienteId: string): Promise<string> {
    this.exigirAcceso(session);
    const eventoId = this.eventoRequerido(session);
    await this.repo.sincronizarEvento(eventoId, session.email);
    const empresa = await this.repo.findVinculoEmpresa(expedienteId);
    if (!empresa) {
      throw new DomainError(
        "El expediente aún no está en la matriz (debe haber sido enviado en el evento activo)",
        API_ERROR_CODES.NOT_FOUND,
        404,
      );
    }
    return empresa.id;
  }

  async detalle(session: DdSession, id: string): Promise<DdMatrizDetalleResultado> {
    this.exigirAcceso(session);
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

    if (dto.identidad) {
      if (!permisos.editarIdentidad) this.prohibido("Sin permiso para editar los datos del vínculo");
      const { ambito, ...datos } = dto.identidad;
      const esAutomatico = vinculo.origen === DD_MATRIZ_ORIGENES.AUTOMATICO;
      if (esAutomatico && Object.values(datos).some((v) => v !== undefined)) {
        throw new DomainError(
          "Los datos de una fila automática vienen del expediente; solo puedes corregir el ámbito.",
          API_ERROR_CODES.VALIDATION,
          400,
        );
      }
      if (datos.nombre !== undefined) cambios.nombre = datos.nombre;
      if (datos.tipoDocumento !== undefined) cambios.tipoDocumento = datos.tipoDocumento?.trim() || null;
      if (datos.documento !== undefined) cambios.documento = datos.documento?.trim() || null;
      if (datos.nacionalidad !== undefined) cambios.nacionalidad = datos.nacionalidad?.trim() || null;
      if (datos.cargo !== undefined) cambios.cargo = datos.cargo?.trim() || null;
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

    if (dto.sig) {
      if (!permisos.editarSig) this.prohibido("Sin permiso para registrar la evaluación de SIG");
      const evaluado = this.evaluar(DD_MATRIZ_AREAS.SIG, vinculo.sig, dto.sig);
      cambios.sig = { ...evaluado, fecha: ahora, responsable: session.email };
    }

    if (dto.reputacional) {
      if (permisos.editarReputacional) {
        const evaluado = this.evaluar(DD_MATRIZ_AREAS.REPUTACIONAL, vinculo.reputacional, dto.reputacional);
        cambios.reputacional = { ...evaluado, fecha: ahora, responsable: session.email };
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
      cambios.compliance = { ...evaluado, fecha: ahora, responsable: session.email };
    }

    if (dto.resultadoFinal !== undefined) {
      if (!permisos.editarFinal) this.prohibido("El resultado final lo registra SIG o Compliance");
      if (normalizarTextoMatriz(dto.resultadoFinal) === "") {
        cambios.resultadoFinal = null;
        cambios.finalFecha = null;
        cambios.finalPor = null;
      } else {
        const final = normalizarResultadoFinal(dto.resultadoFinal);
        if (!final) throw new DomainError("Resultado final no reconocido", API_ERROR_CODES.VALIDATION, 400);
        cambios.resultadoFinal = final;
        cambios.finalFecha = ahora;
        cambios.finalPor = session.email;
      }
    }

    const actualizado = await this.repo.actualizarVinculo(dto.id, cambios);
    await this.repo.registrarAuditoria(
      "matriz_guardar",
      vinculo.expediente.codigo,
      session.email,
      `Matriz DD: se actualizó ${vinculo.nombre} (${Object.keys(dto).filter((k) => k !== "id").join(", ") || "sin cambios"})`,
    );

    const empresa =
      actualizado.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA
        ? actualizado
        : await this.repo.findVinculoEmpresa(actualizado.expediente.expedienteId);
    return {
      vinculo: actualizado,
      empresa,
      adjuntos,
      permisos: this.calcularPermisos(session, actualizado, adjuntos),
    };
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

    const ambito =
      (dto.ambito as DdMatrizAmbito | undefined) ??
      derivarAmbito({ nacionalidad: dto.nacionalidad, tipoDocumento: dto.tipoDocumento });
    const creado = await this.repo.crearVinculoManual({
      expedienteId: dto.expedienteId,
      tipo: dto.tipo as DdMatrizTipoVinculo,
      nombre: dto.nombre.trim(),
      tipoDocumento: dto.tipoDocumento?.trim() || null,
      documento: dto.documento?.trim() || null,
      nacionalidad: dto.nacionalidad?.trim() || null,
      cargo: dto.cargo?.trim() || null,
      ambito,
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
    this.exigirAcceso(session);
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
    return adjunto;
  }

  async eliminarAdjunto(session: DdSession, id: string): Promise<void> {
    this.exigirAcceso(session);
    const adjunto = await this.repo.findAdjunto(id);
    if (!adjunto) throw new DomainError("Adjunto no encontrado", API_ERROR_CODES.NOT_FOUND, 404);
    const vinculo = await this.vinculoRequerido(adjunto.vinculoId);
    const adjuntos = await this.repo.listarAdjuntos(adjunto.vinculoId);
    this.exigirPermisoAdjunto(session, vinculo, adjuntos, adjunto.categoria);
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
  ): void {
    const permisos = this.calcularPermisos(session, vinculo, adjuntos);
    const permitido =
      categoria === DD_MATRIZ_ADJUNTO_CATEGORIAS.REPUTACIONAL_SUSTENTO
        ? permisos.editarReputacional || permisos.editarConclusionReputacional
        : categoria === DD_MATRIZ_ADJUNTO_CATEGORIAS.COMPLIANCE_SUSTENTO
          ? permisos.editarCompliance
          : permisos.editarSig;
    if (!permitido) this.prohibido("Sin permiso para gestionar este adjunto");
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

  private mapearListas(
    entrada: Record<string, string | null>,
    vinculo: DdMatrizVinculoEntity,
    ambito: DdMatrizAmbito,
  ): DdMatrizListasValor {
    const aplicables = new Set(listasAplicables(vinculo.tipo, ambito).map((l) => l.codigo));
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
