import "server-only";

import { DomainError } from "@/domain/errors/domain-error";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type {
  DdBandejaParams,
  DdBandejaResult,
  DdClientesParams,
  DdClientesResult,
  DdEmpresaEstadoEntity,
  DdEmpresaResumen,
  DdEvaluacionEmpresa,
  DdEmpresasParams,
  DdEmpresasResult,
  DdEventoImportacionCatalogo,
  DdExpedienteEntity,
  DdGuardarData,
  DdHistorialCreacion,
  DdHistorialEventoEntity,
  DdLegalResolucionData,
  DdMatrizParams,
  DdMatrizResult,
  DdMisExpedientesParams,
  DdMisExpedientesResult,
  DdObservacionEntity,
  DdPanelData,
  DdReputacionParams,
  DdReputacionResult,
} from "@/domain/models/debida-diligencia";
import type { IDebidaDiligenciaRepository } from "@/domain/ports/debida-diligencia-repository";
import type { IDebidaDiligenciaNotificacionPort } from "@/domain/ports/debida-diligencia-notificacion";
import type { IDebidaDiligenciaDocumentoValidator } from "@/domain/ports/debida-diligencia-documento-validator";
import type {
  DdGuardarRequestDTO,
  DdRegularizarVigenciaRequestDTO,
  DdReputacionResolverRequestDTO,
  DdRevisarRequestDTO,
} from "@/types/dto/debida-diligencia";
import {
  API_ERROR_CODES,
  DD_ACCIONES_LEGAL,
  DD_ACCIONES_REVISION,
  DD_ALCANCES_REVISION,
  DD_DOCUMENTO_ESTADOS,
  DD_ESTADOS,
  DD_ESTADOS_EVALUACION,
  DD_HISTORIAL_TIPOS,
  DD_ORIGENES,
  DD_OBSERVACION_AREAS,
  DD_OBSERVACION_ESTADOS,
  DD_REPUTACION_ESTADOS,
  DD_REPUTACION_RESULTADOS,
  DD_RESULTADOS,
  DD_MATRIZ_PER_PAGE_MAX,
  DD_DOCUMENTOS,
  DD_DOCUMENTOS_REQUERIDOS,
  DD_EVENTO_TODOS,
  DD_MENSAJES,
  DD_IMPORT_EVENTO_TIPOS,
  DD_PER_PAGE_MAX,
  DD_RUTAS,
  PERMISSIONS,
  ROLES,
  type DdDocumentoTipo,
} from "@/lib/shared/constants";
import { DD_VIGENCIAS, ddUtils } from "@/lib/shared/utils/debida-diligencia";
import { dateUtils } from "@/lib/shared/utils/date";

export interface DdSession {
  email: string;
  roles: string[];
  permissions: string[];
  eventoId?: string;
}

interface DdMiExpedienteResultado {
  expediente: DdExpedienteEntity | null;
  empresa: DdEmpresaResumen | null;
  estadoExterno: DdEmpresaEstadoEntity | null;
  esOtroEvento: boolean;
  requiereDeclaracionVigencia: boolean;
  puedeRegularizarDeclaracionVigencia: boolean;
  declaracionVigenciaEstado: string | null;
}

/**
 * Casos de uso del modulo Debida Diligencia.
 * Reglas separadas del resto del sistema: permisos `dd:*`, vigencia de 6 meses,
 * revision de Logistica y revision reputacional de Comunicaciones.
 */
export class DebidaDiligenciaApplicationService {
  constructor(
    private readonly repo: IDebidaDiligenciaRepository,
    private readonly authRepo: IAuthRepository,
    private readonly notificaciones: IDebidaDiligenciaNotificacionPort,
    private readonly documentoValidator: IDebidaDiligenciaDocumentoValidator,
  ) {}

  private esAdmin(session: DdSession): boolean {
    return session.roles.includes(ROLES.ADMIN);
  }

  private tienePermiso(session: DdSession, permiso: string): boolean {
    return this.esAdmin(session) || session.permissions.includes(permiso);
  }

  private exigirPermiso(session: DdSession, permiso: string): void {
    if (!this.tienePermiso(session, permiso)) {
      throw new DomainError("Sin permiso para acceder a Debida Diligencia", API_ERROR_CODES.FORBIDDEN, 403);
    }
  }

  private async empresaDelUsuario(session: DdSession): Promise<string> {
    const empresaId = await this.authRepo.findEmpresaIdDeUsuario(session.email);
    if (!empresaId) {
      throw new DomainError(
        "Tu cuenta no está vinculada a una empresa. Completa tus datos de empresa en el perfil para iniciar la debida diligencia.",
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    return empresaId;
  }

  private eventoRequerido(session: DdSession): string {
    if (!session.eventoId) {
      throw new DomainError("Selecciona un evento activo para continuar", API_ERROR_CODES.VALIDATION, 400);
    }
    return session.eventoId;
  }

  private async expedienteConAcceso(id: string, session: DdSession): Promise<DdExpedienteEntity> {
    const expediente = await this.repo.findExpedientePorId(id);
    if (!expediente) throw new DomainError("Expediente no encontrado", API_ERROR_CODES.NOT_FOUND, 404);

    const esStaff =
      this.tienePermiso(session, PERMISSIONS.DD_VER) ||
      this.tienePermiso(session, PERMISSIONS.DD_REVISION) ||
      this.tienePermiso(session, PERMISSIONS.DD_LEGAL) ||
      this.tienePermiso(session, PERMISSIONS.DD_REPUTACION) ||
      this.tienePermiso(session, PERMISSIONS.DD_PANEL);
    if (!esStaff) {
      const empresaId = await this.empresaDelUsuario(session);
      if (empresaId !== expediente.empresaId) {
        throw new DomainError("No puedes consultar este expediente", API_ERROR_CODES.FORBIDDEN, 403);
      }
    }
    return expediente;
  }

  private async registrarHistorial(
    expedienteId: string,
    data: DdHistorialCreacion,
  ): Promise<void> {
    await this.repo.registrarHistorial(expedienteId, data);
  }

  /**
   * Historial del expediente: eventos de workflow persistidos y observaciones
   * emitidas por las areas. El cliente solo puede ver su propia empresa.
   */
  async historial(
    expedienteId: string,
    session: DdSession,
  ): Promise<{ eventos: DdHistorialEventoEntity[]; observaciones: DdObservacionEntity[] }> {
    const expediente = await this.expedienteConAcceso(expedienteId, session);
    const [eventos, observaciones] = await Promise.all([
      this.repo.listarHistorial(expediente.id),
      this.repo.listarObservaciones(expediente.id),
    ]);
    return {
      eventos: eventos.length > 0 ? eventos : this.eventosHistoricos(expediente),
      observaciones,
    };
  }

  /**
   * Reconstruye hitos para expedientes creados antes de existir la tabla de
   * historial. Solo se usa cuando no hay eventos persistidos, para no duplicar
   * los hitos de los flujos nuevos.
   */
  private eventosHistoricos(expediente: DdExpedienteEntity): DdHistorialEventoEntity[] {
    const eventos: DdHistorialEventoEntity[] = [];
    const push = (evento: Omit<DdHistorialEventoEntity, "id" | "metadata"> & { id: string }) => {
      eventos.push({ ...evento, metadata: { historico: true } });
    };
    const esImportado = expediente.origen === DD_ORIGENES.IMPORTADO;
    if (expediente.fechaEnvio) {
      push({
        id: "historico-envio",
        tipo: DD_HISTORIAL_TIPOS.ENVIO,
        area: null,
        estado: DD_ESTADOS.EN_REVISION,
        titulo: "Expediente enviado a revisión",
        detalle: "Registro reconstruido desde las fechas del expediente.",
        actor: expediente.creadoPor,
        createdAt: expediente.fechaEnvio,
      });
    }
    if (esImportado && expediente.fechaRevision) {
      const estadoOrigen = expediente.estadoOrigen?.trim();
      const cese = expediente.fechaVencimiento
        ? ` Fecha de cese: ${dateUtils.format(expediente.fechaVencimiento)}.`
        : "";
      push({
        id: "historico-fin-dd",
        tipo: DD_HISTORIAL_TIPOS.FIN_DD,
        area: DD_OBSERVACION_AREAS.LOGISTICA,
        estado: expediente.estado,
        titulo: "Fin de DD",
        detalle: `${estadoOrigen ? `Resultado: ${estadoOrigen}. ` : ""}Fin de DD registrado en la fuente oficial.${cese}`,
        actor: expediente.revisadoPor ?? "SIG",
        createdAt: expediente.fechaRevision,
      });
    }
    if (expediente.fechaDerivacionLegal) {
      push({
        id: "historico-derivacion-legal",
        tipo: DD_HISTORIAL_TIPOS.DERIVACION_LEGAL,
        area: DD_OBSERVACION_AREAS.LOGISTICA,
        estado: DD_ESTADOS.EN_LEGAL,
        titulo: "Expediente derivado a Legal",
        detalle: "Registro reconstruido desde las fechas del expediente.",
        actor: expediente.derivadoLegalPor ?? expediente.revisadoPor ?? expediente.creadoPor,
        createdAt: expediente.fechaDerivacionLegal,
      });
    }
    if (expediente.fechaLegal && expediente.decisionLegal) {
      const rechazada = expediente.decisionLegal === DD_ACCIONES_LEGAL.RECHAZAR;
      const observada = expediente.decisionLegal === DD_ACCIONES_LEGAL.OBSERVAR;
      if (!observada) {
        push({
          id: "historico-legal",
          tipo: rechazada
            ? DD_HISTORIAL_TIPOS.LEGAL_RECHAZO
            : DD_HISTORIAL_TIPOS.LEGAL_APROBACION,
          area: DD_OBSERVACION_AREAS.LEGAL,
          estado: expediente.estado,
          titulo: rechazada ? "Debida diligencia rechazada por Legal" : "Revisión legal aprobada",
          detalle: expediente.motivoLegal ?? "Registro reconstruido desde las fechas del expediente.",
          actor: expediente.legalRevisor ?? expediente.creadoPor,
          createdAt: expediente.fechaLegal,
        });
      }
    }
    if (expediente.fechaAprobacion && !(esImportado && expediente.fechaRevision)) {
      push({
        id: "historico-aprobacion",
        tipo: DD_HISTORIAL_TIPOS.APROBACION,
        area: DD_OBSERVACION_AREAS.LOGISTICA,
        estado: DD_ESTADOS.APROBADA,
        titulo: "Debida diligencia aprobada",
        detalle: "Registro reconstruido desde las fechas del expediente.",
        actor: expediente.revisadoPor ?? expediente.creadoPor,
        createdAt: expediente.fechaAprobacion,
      });
    }
    if (
      expediente.fechaRechazo &&
      expediente.decisionLegal !== DD_ACCIONES_LEGAL.RECHAZAR &&
      !(esImportado && expediente.fechaRevision)
    ) {
      push({
        id: "historico-rechazo",
        tipo: DD_HISTORIAL_TIPOS.RECHAZO,
        area: DD_OBSERVACION_AREAS.LOGISTICA,
        estado: DD_ESTADOS.RECHAZADA,
        titulo: "Debida diligencia rechazada",
        detalle: expediente.motivoRechazo ?? "Registro reconstruido desde las fechas del expediente.",
        actor: expediente.revisadoPor ?? expediente.creadoPor,
        createdAt: expediente.fechaRechazo,
      });
    }
    return eventos;
  }

  /** Expediente de la empresa del usuario para el evento activo. */
  async obtenerMiExpediente(
    session: DdSession,
    opciones: { soloEvento?: boolean } = {},
  ): Promise<DdMiExpedienteResultado> {
    this.exigirPermiso(session, PERMISSIONS.DD_FORMULARIO);
    const empresaId = await this.empresaDelUsuario(session);
    const eventoId = this.eventoRequerido(session);
    const [expedienteActivo, empresa] = await Promise.all([
      this.repo.findExpedientePorEmpresaEvento(empresaId, eventoId),
      this.repo.findEmpresaResumen(empresaId),
    ]);
    /*
     * La validez prevalece sobre el evento: si la DD activa no esta aprobada
     * o ya vencio, se busca cualquier DD aprobada vigente de la empresa.
     * En su portada no se ofrece iniciar otra mientras exista una vigente.
     */
    const activoVigente =
      expedienteActivo?.estado === DD_ESTADOS.APROBADA &&
      ddUtils.estadoVigencia(
        expedienteActivo.estado,
        expedienteActivo.fechaVencimiento,
        undefined,
        expedienteActivo.fechaAprobacion,
      ) !== DD_VIGENCIAS.VENCIDA;
    let expediente = expedienteActivo;
    let esOtroEvento = false;
    if (!opciones.soloEvento && !activoVigente) {
      const vigente = await this.repo.findExpedienteAprobadoVigentePorEmpresa(
        empresaId,
        dateUtils.now(),
      );
      if (vigente) {
        expediente = vigente;
        esOtroEvento = vigente.eventoId !== eventoId;
      }
    }
    const requiereDeclaracionVigencia = expediente
      ? ddUtils.requiereRevalidacionDeclaracion(expediente, eventoId)
      : false;
    const declaracionVigenciaEstado = expediente
      ? ddUtils.estadoDeclaracionVigencia(expediente.documentos)
      : null;
    const estadoExterno = await this.repo.findEmpresaEstado(
      empresa?.ruc ?? null,
      empresa?.razonSocial ?? null,
    );
    const puedeRegularizarDeclaracionVigencia = expediente
      ? ddUtils.puedeCargarDeclaracionVigencia(expediente, eventoId)
      : false;
    return {
      expediente,
      empresa,
      estadoExterno,
      esOtroEvento,
      requiereDeclaracionVigencia,
      puedeRegularizarDeclaracionVigencia,
      declaracionVigenciaEstado,
    };
  }

  /** Historial paginado de todas las DD de la empresa del usuario. */
  async misExpedientes(
    params: Omit<DdMisExpedientesParams, "empresaId">,
    session: DdSession,
  ): Promise<DdMisExpedientesResult> {
    this.exigirPermiso(session, PERMISSIONS.DD_FORMULARIO);
    const empresaId = await this.empresaDelUsuario(session);
    return this.repo.listarMisExpedientes({
      empresaId,
      page: Math.max(1, params.page),
      perPage: Math.min(DD_PER_PAGE_MAX, Math.max(1, params.perPage)),
      search: params.search?.trim() || undefined,
      estado: params.estado,
      eventoId: params.eventoId,
    });
  }

  /**
   * Inicia una nueva DD cuando la ultima ya no admite edicion. Solo permite
   * renovar una aprobada vencida o reemplazar una rechazada.
   */
  async iniciarNueva(session: DdSession): Promise<DdExpedienteEntity> {
    this.exigirPermiso(session, PERMISSIONS.DD_FORMULARIO);
    const empresaId = await this.empresaDelUsuario(session);
    const eventoId = this.eventoRequerido(session);
    const actual = await this.repo.findExpedientePorEmpresaEvento(empresaId, eventoId);
    if (actual && ddUtils.puedeEditar(actual.estado)) return actual;

    if (actual) {
      const vencida =
        actual.estado === DD_ESTADOS.APROBADA &&
        ddUtils.estadoVigencia(
          actual.estado,
          actual.fechaVencimiento,
          undefined,
          actual.fechaAprobacion,
        ) === DD_VIGENCIAS.VENCIDA;
      if (actual.estado !== DD_ESTADOS.RECHAZADA && !vencida) {
        throw new DomainError(
          "La debida diligencia actual aún no puede renovarse.",
          API_ERROR_CODES.CONFLICT,
          409,
        );
      }
    }

    const codigo = await this.repo.siguienteCodigo(String(dateUtils.currentYear()));
    const expediente = await this.repo.crearExpediente({
      empresaId,
      eventoId,
      codigo,
      creadoPor: session.email,
    });
    await this.repo.registrarAuditoria(
      "iniciar-nueva",
      `debida_diligencia:${expediente.codigo}`,
      session.email,
      "El cliente inició una nueva debida diligencia",
    );
    return expediente;
  }

  /** Guarda el wizard (borrador o correccion de observaciones). */
  async guardar(dto: DdGuardarRequestDTO, session: DdSession): Promise<DdExpedienteEntity> {
    this.exigirPermiso(session, PERMISSIONS.DD_FORMULARIO);
    const empresaId = await this.empresaDelUsuario(session);
    const eventoId = this.eventoRequerido(session);

    let expediente = await this.repo.findExpedientePorEmpresaEvento(empresaId, eventoId);
    if (expediente && !ddUtils.puedeEditar(expediente.estado)) {
      const mensaje =
        expediente.estado === DD_ESTADOS.EN_REVISION
          ? "El expediente está en revisión. Espera el resultado antes de modificarlo."
          : expediente.estado === DD_ESTADOS.APROBADA
            ? "La debida diligencia aprobada no se puede editar. Inicia una nueva cuando llegue a su fecha de cese."
            : "El expediente fue rechazado. Inicia una nueva debida diligencia.";
      throw new DomainError(mensaje, API_ERROR_CODES.CONFLICT, 409);
    }

    const data: DdGuardarData = {
      tipoRelacionComercial: dto.tipoRelacionComercial,
      actividadEconomica: dto.actividadEconomica ?? null,
      actividadEconomicaOtro: dto.actividadEconomicaOtro ?? null,
      paisConstitucion: dto.paisConstitucion ?? null,
      sitioWeb: dto.sitioWeb ?? null,
      emailRepresentante: dto.emailRepresentante ?? null,
      aceptaDatos: dto.aceptaDatos,
      aceptaVerificacion: dto.aceptaVerificacion,
      declaraVerdad: dto.declaraVerdad,
      representanteNombre: dto.representanteNombre ?? null,
      representanteTipoDocumento: dto.representanteTipoDocumento ?? null,
      representanteDocumento: dto.representanteDocumento ?? null,
      representanteNacionalidad: dto.representanteNacionalidad ?? null,
      beneficiarios: dto.beneficiarios.map((b, indice) => ({
        orden: indice,
        nombre: b.nombre,
        documento: b.documento,
        nacionalidad: b.nacionalidad,
        porcentaje: b.porcentaje,
      })),
      documentos: dto.documentos.map((d) => ({
        tipo: d.tipo,
        nombre: d.nombre,
        url: d.url,
        estado: DD_DOCUMENTO_ESTADOS.CARGADO,
      })),
    };

    const tiposPermitidos = new Set([
      ...DD_DOCUMENTOS_REQUERIDOS.map((d) => d.tipo),
      DD_DOCUMENTOS.DECLARACION_VIGENCIA,
      DD_DOCUMENTOS.ADICIONAL,
    ]);
    for (const documento of data.documentos) {
      if (!tiposPermitidos.has(documento.tipo)) {
        throw new DomainError("Tipo de documento inválido", API_ERROR_CODES.VALIDATION, 400);
      }
    }
    await Promise.all(
      data.documentos.map((documento) =>
        this.documentoValidator.validarDocumento({
          url: documento.url,
          nombre: documento.nombre,
          tipo: documento.tipo,
        }),
      ),
    );

    if (expediente?.estado === DD_ESTADOS.OBSERVADA) {
      const expedienteActual = expediente;
      const observaciones = await this.repo.listarObservaciones(expedienteActual.id);
      const tiposEditables = new Set([
        ...expedienteActual.documentos
          .filter((documento) => documento.estado === DD_DOCUMENTO_ESTADOS.OBSERVADO)
          .map((documento) => documento.tipo),
        ...observaciones
          .filter((observacion) => {
            if (observacion.estado !== DD_OBSERVACION_ESTADOS.ABIERTA || !observacion.documentoTipo) return false;
            const documento = expedienteActual.documentos.find((item) => item.tipo === observacion.documentoTipo);
            return documento?.estado !== DD_DOCUMENTO_ESTADOS.APROBADO;
          })
          .map((observacion) => observacion.documentoTipo as DdDocumentoTipo),
      ]);
      for (const documento of data.documentos) {
        const actual = expedienteActual.documentos.find((item) => item.tipo === documento.tipo);
        if (actual && actual.url !== documento.url && !tiposEditables.has(documento.tipo)) {
          throw new DomainError(
            `El documento "${actual.nombre}" ya fue aprobado y no se puede reemplazar.`,
            API_ERROR_CODES.CONFLICT,
            409,
          );
        }
      }
    }

    if (!expediente) {
      const anio = String(dateUtils.currentYear());
      const codigo = await this.repo.siguienteCodigo(anio);
      expediente = await this.repo.crearExpediente({
        empresaId,
        eventoId,
        codigo,
        creadoPor: session.email,
      });
    }

    const actualizado = await this.repo.guardarFormulario(expediente.id, data, session.email);
    await this.repo.registrarAuditoria(
      "guardar",
      `debida_diligencia:${expediente.codigo}`,
      session.email,
      "Se guardó el formulario de debida diligencia",
    );
    return actualizado;
  }

  /** Envia el expediente a revision (o lo reenvia tras subsanar observaciones). */
  async enviar(session: DdSession): Promise<DdExpedienteEntity> {
    this.exigirPermiso(session, PERMISSIONS.DD_FORMULARIO);
    const empresaId = await this.empresaDelUsuario(session);
    const eventoId = this.eventoRequerido(session);
    const expediente = await this.repo.findExpedientePorEmpresaEvento(empresaId, eventoId);
    if (!expediente) throw new DomainError("Primero completa el formulario", API_ERROR_CODES.NOT_FOUND, 404);
    if (!ddUtils.puedeEditar(expediente.estado)) {
      throw new DomainError("El expediente ya fue enviado a revisión", API_ERROR_CODES.CONFLICT, 409);
    }

    const errores = ddUtils.erroresDeEnvio(expediente);
    if (errores.length > 0) {
      throw new DomainError(errores.join(" "), API_ERROR_CODES.VALIDATION, 400);
    }
    const faltantes = ddUtils.documentosFaltantes(expediente.documentos);
    if (faltantes.length > 0) {
      throw new DomainError("Faltan documentos obligatorios", API_ERROR_CODES.VALIDATION, 400);
    }
    const requiereDeclaracionVigencia =
      await this.repo.tieneExpedienteImportadoAprobadoVigente(empresaId, dateUtils.now());
    if (
      requiereDeclaracionVigencia &&
      !expediente.documentos.some(
        (documento) =>
          documento.tipo === DD_DOCUMENTOS.DECLARACION_VIGENCIA &&
          documento.estado !== DD_DOCUMENTO_ESTADOS.PENDIENTE,
      )
    ) {
      throw new DomainError(
        DD_MENSAJES.DECLARACION_VIGENCIA_OBLIGATORIA,
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    const observaciones = await this.repo.listarObservaciones(expediente.id);
    /*
     * Marcador exclusivo del nuevo flujo de observacion legal. No inferir por
     * `area = legal`: las derivaciones historicas de Logistica tambien crean
     * observaciones de area legal y no deben cambiar el retorno a Logistica.
     */
    const volveraLegal = expediente.decisionLegal === DD_ACCIONES_LEGAL.OBSERVAR;
    const requiereDocumentoAdicional = observaciones.some(
      (observacion) =>
        observacion.estado === DD_OBSERVACION_ESTADOS.ABIERTA &&
        observacion.documentoTipo === DD_DOCUMENTOS.ADICIONAL,
    );
    if (
      requiereDocumentoAdicional &&
      !expediente.documentos.some(
        (documento) => documento.tipo === DD_DOCUMENTOS.ADICIONAL && documento.estado !== DD_DOCUMENTO_ESTADOS.PENDIENTE,
      )
    ) {
      throw new DomainError(
        "Debe adjuntar el documento adicional solicitado por el revisor",
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }

    await Promise.all(
      expediente.documentos.map((documento) =>
        this.documentoValidator.validarDocumento({
          url: documento.url,
          nombre: documento.nombre,
          tipo: documento.tipo,
        }),
      ),
    );
    await this.repo.resolverObservaciones(expediente.id);
    const actualizado = await this.repo.actualizarEstado(expediente.id, {
      estado: volveraLegal ? DD_ESTADOS.EN_LEGAL : DD_ESTADOS.EN_REVISION,
      fechaEnvio: dateUtils.now(),
      actualizadoPor: session.email,
    });
    await this.repo.registrarAuditoria(
      "enviar",
      `debida_diligencia:${actualizado.codigo}`,
      session.email,
      volveraLegal
        ? "El cliente subsanó la observación y reenvió el expediente a revisión legal"
        : "El cliente envió la debida diligencia a revisión",
    );

    const observacionesAbiertas = observaciones.filter(
      (observacion) => observacion.estado === DD_OBSERVACION_ESTADOS.ABIERTA,
    ).length;
    const esReenvio = volveraLegal || observacionesAbiertas > 0;
    await this.registrarHistorial(actualizado.id, {
      tipo: esReenvio ? DD_HISTORIAL_TIPOS.REENVIO : DD_HISTORIAL_TIPOS.ENVIO,
      estado: actualizado.estado,
      titulo: volveraLegal
        ? "Expediente reenviado a Legal"
        : esReenvio
          ? "Expediente reenviado a Logística"
          : "Expediente enviado a revisión",
      detalle: volveraLegal
        ? "El cliente corrigió las observaciones y solicitó una nueva revisión legal."
        : esReenvio
          ? `El cliente respondió ${observacionesAbiertas} observación(es) y solicitó una nueva revisión.`
          : "El cliente completó el formulario y lo envió para revisión.",
      actor: session.email,
      metadata: {
        observacionesRespondidas: observacionesAbiertas,
        reenvioLegal: volveraLegal,
      },
    });

    if (volveraLegal) {
      await this.notificaciones.notificarLegal({
        codigo: actualizado.codigo,
        razonSocial: actualizado.empresa.razonSocial,
        motivo: "El cliente subsanó la observación de Legal.",
      });
    }

    const destino =
      actualizado.emailRepresentante ??
      actualizado.empresa.representanteCorreo ??
      actualizado.empresa.emailContacto;
    if (destino) {
      await this.notificaciones.expedienteRecibido({
        to: destino,
        codigo: actualizado.codigo,
        razonSocial: actualizado.empresa.razonSocial,
      });
    }
    return actualizado;
  }

  /** Bandeja paginada de Logistica. */
  async bandeja(
    params: Omit<DdBandejaParams, "eventoId"> & { eventoId?: string },
    session: DdSession,
  ): Promise<DdBandejaResult> {
    this.exigirPermiso(session, PERMISSIONS.DD_REVISION);
    const eventoId =
      params.eventoId === DD_EVENTO_TODOS
        ? undefined
        : params.eventoId ?? this.eventoRequerido(session);
    return this.repo.listarBandeja({
      eventoId,
      eventoActivoId: this.eventoRequerido(session),
      page: Math.max(1, params.page),
      perPage: Math.min(DD_PER_PAGE_MAX, Math.max(1, params.perPage)),
      search: params.search?.trim() || undefined,
      estado: params.estado,
      origen: params.origen,
      vinculo: params.vinculo,
      documentos: params.documentos,
      reputacion: params.reputacion,
      asignacion: params.asignacion,
      solicitudes: params.solicitudes,
      multiples: params.multiples,
      orden: params.orden,
    });
  }

  /** Bandeja de expedientes derivados a Legal. */
  async bandejaLegal(
    params: Omit<DdBandejaParams, "eventoId" | "estado">,
    session: DdSession,
  ): Promise<DdBandejaResult> {
    this.exigirPermiso(session, PERMISSIONS.DD_LEGAL);
    const eventoId = this.eventoRequerido(session);
    return this.repo.listarBandeja({
      eventoId,
      eventoActivoId: this.eventoRequerido(session),
      page: Math.max(1, params.page),
      perPage: Math.min(DD_PER_PAGE_MAX, Math.max(1, params.perPage)),
      search: params.search?.trim() || undefined,
      estado: DD_ESTADOS.EN_LEGAL,
      origen: params.origen,
      vinculo: params.vinculo,
      documentos: params.documentos,
      reputacion: params.reputacion,
      asignacion: params.asignacion,
      solicitudes: params.solicitudes,
      orden: params.orden,
    });
  }

  /** Clientes con evaluacion de DD, resultado institucional y vigencia. */
  async clientes(
    params: Omit<DdClientesParams, "eventoId">,
    session: DdSession,
  ): Promise<DdClientesResult> {
    this.exigirPermiso(session, PERMISSIONS.DD_VER);
    const eventoId = this.eventoRequerido(session);
    const resultado = await this.repo.listarClientes({
      eventoId,
      page: Math.max(1, params.page),
      perPage: Math.min(DD_PER_PAGE_MAX, Math.max(1, params.perPage)),
      search: params.search?.trim() || undefined,
      ruc: params.ruc?.trim() || undefined,
      estado: params.estado,
      resultado: params.resultado,
      estadoEvaluacion: params.estadoEvaluacion,
    });

    return {
      ...resultado,
      data: resultado.data.map((expediente) => {
        const observacionesAbiertas = expediente.observaciones.filter((observacion) => {
          if (observacion.estado !== DD_OBSERVACION_ESTADOS.ABIERTA) return false;
          if (!observacion.documentoTipo) return true;
          const documento = expediente.documentos.find(
            (item) => item.tipo === observacion.documentoTipo,
          );
          return documento?.estado !== DD_DOCUMENTO_ESTADOS.APROBADO;
        }).length;
        const resultadoEvaluacion = ddUtils.resultadoEvaluacion(
          expediente.estado,
          observacionesAbiertas,
        );
        const estadoEvaluacion = ddUtils.estadoEvaluacion(
          expediente.estado,
          expediente.fechaVencimiento,
          undefined,
          expediente.fechaAprobacion,
        );
        return {
          expediente,
          resultado: resultadoEvaluacion,
          estadoEvaluacion,
          vigente: estadoEvaluacion === DD_ESTADOS_EVALUACION.VIGENTE,
          diasVigenciaRestantes: ddUtils.diasVigenciaRestantes(
            expediente.estado,
            expediente.fechaVencimiento,
            undefined,
            expediente.fechaAprobacion,
          ),
          aptoParaContratar: ddUtils.aptoParaContratar(
            resultadoEvaluacion,
            estadoEvaluacion,
            expediente.declaraVerdad,
            expediente.origen === DD_ORIGENES.IMPORTADO,
          ),
          alcance: ddUtils.alcanceResultado(resultadoEvaluacion),
          observacionesAbiertas,
        };
      }),
    };
  }

  /**
   * Evaluacion de DD de la empresa vinculada a la cuenta de una solicitud.
   * La usan las revisiones de Solicitudes para bloquear el flujo cuando la
   * empresa no tiene una DD APTA y vigente.
   */
  async evaluacionDeUsuario(
    email: string | null,
    eventoId: string,
    razonSocial?: string | null,
  ): Promise<DdEvaluacionEmpresa> {
    const empresaId =
      (email ? await this.authRepo.findEmpresaIdDeUsuario(email) : null) ??
      (razonSocial ? await this.repo.findEmpresaIdPorRazonSocial(razonSocial) : null);

    const [actual, empresa] = empresaId
      ? await Promise.all([
          this.repo.findExpedientePorEmpresaEvento(empresaId, eventoId),
          this.repo.findEmpresaResumen(empresaId),
        ])
      : [null, null];

    const actualVigente =
      actual?.estado === DD_ESTADOS.APROBADA &&
      ddUtils.estadoVigencia(
        actual.estado,
        actual.fechaVencimiento,
        undefined,
        actual.fechaAprobacion,
      ) !== DD_VIGENCIAS.VENCIDA;
    /* La validez de otro evento tambien aplica; el evento solo define el contexto. */
    const vigenteEvento = actualVigente || !empresaId
      ? null
      : await this.repo.findExpedienteAprobadoVigentePorEmpresaEvento(
          empresaId,
          eventoId,
          dateUtils.now(),
        );
    const vigente = actualVigente || vigenteEvento || !empresaId
      ? vigenteEvento
      : await this.repo.findExpedienteAprobadoVigentePorEmpresa(empresaId, dateUtils.now());
    const expediente = actualVigente ? actual : vigente ?? actual;
    const declaracionVigenciaEstado = expediente
      ? ddUtils.estadoDeclaracionVigencia(expediente.documentos)
      : null;
    const requiereDeclaracionVigencia = expediente
      ? ddUtils.requiereRevalidacionDeclaracion(expediente, eventoId)
      : false;
    const interna = this.evaluacionDeEmpresa(expediente, empresa, eventoId);
    if (requiereDeclaracionVigencia) {
      const mensaje =
        declaracionVigenciaEstado === DD_DOCUMENTO_ESTADOS.OBSERVADO
          ? "La Declaración jurada de vigencia de información está observada. La solicitud no puede revisarse hasta que sea corregida y aprobada."
          : declaracionVigenciaEstado === DD_DOCUMENTO_ESTADOS.CARGADO
            ? "La Declaración jurada de vigencia de información está pendiente de validación. La solicitud no puede revisarse hasta que sea aprobada."
            : "La empresa tiene una DD APTA y vigente, pero le falta la Declaración jurada de vigencia de información. La solicitud no puede revisarse hasta que sea cargada y aprobada.";
      return {
        ...interna,
        vigente: true,
        aptoParaContratar: false,
        requiereDeclaracionVigencia: true,
        declaracionVigenciaEstado,
        mensaje,
      };
    }
    if (interna.aptoParaContratar) {
      return interna;
    }

    const externa = await this.repo.findEmpresaEstado(
      empresa?.ruc ?? null,
      razonSocial ?? empresa?.razonSocial ?? null,
    );
    const evaluacionExterna = this.evaluacionDeEmpresaExterna(externa, empresa);
    return evaluacionExterna.aptoParaContratar ? evaluacionExterna : interna;
  }

  /** Evaluacion de la DD manual/externa: cuenta como aprobada si esta APTA y vigente. */
  private evaluacionDeEmpresaExterna(
    estado: DdEmpresaEstadoEntity | null,
    empresa: DdEmpresaResumen | null,
  ): DdEvaluacionEmpresa {
    if (!estado) return this.evaluacionDeEmpresa(null, empresa);

    const fechaVencimiento =
      estado.fechaVencimiento ??
      (estado.fechaRevision ? ddUtils.sumarMeses(estado.fechaRevision) : null);
    const estadoEvaluacion = ddUtils.estadoEvaluacionExterna(
      estado.resultado,
      fechaVencimiento,
    );
    const vigente = estadoEvaluacion === DD_ESTADOS_EVALUACION.VIGENTE;
    const aptoParaContratar =
      vigente &&
      (estado.resultado === DD_RESULTADOS.APTO ||
        estado.resultado === DD_RESULTADOS.APTO_CON_OBSERVACIONES);
    const mensaje = aptoParaContratar
      ? null
      : estado.resultado === DD_RESULTADOS.NO_APTO
        ? "La empresa no es APTA según el registro externo de Debida Diligencia."
        : "La empresa aún no cuenta con una Debida Diligencia APTA y vigente en el registro externo.";

    return {
      empresa,
      expediente: null,
      resultado: estado.resultado,
      estadoEvaluacion,
      vigente,
      aptoParaContratar,
      requiereDeclaracionVigencia: false,
      declaracionVigenciaEstado: null,
      observacionesAbiertas: 0,
      mensaje,
    };
  }

  /** Calcula el resultado institucional de una empresa a partir de su expediente. */
  private evaluacionDeEmpresa(
    expediente: DdExpedienteEntity | null,
    empresa: DdEmpresaResumen | null,
    eventoActivoId?: string,
  ): DdEvaluacionEmpresa {
    if (!expediente) {
      return {
        empresa,
        expediente: null,
        resultado: DD_RESULTADOS.PENDIENTE,
        estadoEvaluacion: null,
        vigente: false,
        aptoParaContratar: false,
        requiereDeclaracionVigencia: false,
        declaracionVigenciaEstado: null,
        observacionesAbiertas: 0,
        mensaje:
          "La empresa no ha pasado por Debida Diligencia. La solicitud no puede revisarse hasta que cuente con una DD APTA y vigente.",
      };
    }

    const observacionesAbiertas = expediente.observaciones.filter((observacion) => {
      if (observacion.estado !== DD_OBSERVACION_ESTADOS.ABIERTA) return false;
      if (!observacion.documentoTipo) return true;
      const documento = expediente.documentos.find((item) => item.tipo === observacion.documentoTipo);
      return documento?.estado !== DD_DOCUMENTO_ESTADOS.APROBADO;
    }).length;
    const resultado = ddUtils.resultadoEvaluacion(expediente.estado, observacionesAbiertas);
    const estadoEvaluacion = ddUtils.estadoEvaluacion(
      expediente.estado,
      expediente.fechaVencimiento,
      undefined,
      expediente.fechaAprobacion,
    );
    const vigente = estadoEvaluacion === DD_ESTADOS_EVALUACION.VIGENTE;
    const declaracionVigenciaEstado = ddUtils.estadoDeclaracionVigencia(expediente.documentos);
    const requiereDeclaracionVigencia = ddUtils.requiereRevalidacionDeclaracion(
      expediente,
      eventoActivoId,
    );
    const aptoParaContratar =
      !requiereDeclaracionVigencia &&
      ddUtils.aptoParaContratar(
        resultado,
        estadoEvaluacion,
        expediente.declaraVerdad,
        expediente.origen === DD_ORIGENES.IMPORTADO,
      );

    let mensaje: string | null = null;
    if (!aptoParaContratar) {
      if (requiereDeclaracionVigencia) {
        mensaje =
          declaracionVigenciaEstado === DD_DOCUMENTO_ESTADOS.OBSERVADO
            ? "La Declaración jurada de vigencia de información está observada. La solicitud no puede revisarse hasta que sea corregida y aprobada."
            : declaracionVigenciaEstado === DD_DOCUMENTO_ESTADOS.CARGADO
              ? "La Declaración jurada de vigencia de información está pendiente de validación. La solicitud no puede revisarse hasta que sea aprobada."
              : "La empresa tiene una DD APTA y vigente, pero le falta la Declaración jurada de vigencia de información. La solicitud no puede revisarse hasta que sea cargada y aprobada.";
      } else if (expediente.estado === DD_ESTADOS.RECHAZADA) {
        mensaje =
          "La Debida Diligencia de la empresa fue rechazada. La solicitud no puede revisarse hasta que cuente con una DD APTA y vigente.";
      } else if (expediente.estado === DD_ESTADOS.APROBADA) {
        mensaje =
          "La Debida Diligencia de la empresa está vencida o no tiene la declaración de veracidad vigente. La solicitud no puede revisarse hasta que cuente con una DD APTA y vigente.";
      } else if (expediente.estado === DD_ESTADOS.OBSERVADA) {
        mensaje =
          "La Debida Diligencia de la empresa está observada. La solicitud no puede revisarse hasta que cuente con una DD APTA y vigente.";
      } else {
        mensaje =
          "La Debida Diligencia de la empresa aún está en proceso. La solicitud no puede revisarse hasta que cuente con una DD APTA y vigente.";
      }
    }

    return {
      empresa,
      expediente,
      resultado,
      estadoEvaluacion,
      vigente,
      aptoParaContratar,
      requiereDeclaracionVigencia,
      declaracionVigenciaEstado,
      observacionesAbiertas,
      mensaje,
    };
  }

  /** Lista consolidada de empresas y su estado externo de DD. */
  async empresas(
    params: Omit<DdEmpresasParams, "page" | "perPage"> & { page: number; perPage: number },
    session: DdSession,
  ): Promise<DdEmpresasResult> {
    this.exigirPermiso(session, PERMISSIONS.DD_VER);
    const resultado = await this.repo.listarEmpresasEstados({
      ...params,
      page: Math.max(1, params.page),
      perPage: Math.min(DD_PER_PAGE_MAX, Math.max(1, params.perPage)),
    });
    const ahora = dateUtils.now();

    return {
      ...resultado,
      data: resultado.data.map((empresa) => {
        const fechaVencimiento =
          empresa.fechaVencimiento ??
          (empresa.fechaRevision ? ddUtils.sumarMeses(empresa.fechaRevision) : null);
        const estadoEvaluacion = ddUtils.estadoEvaluacionExterna(
          empresa.resultado,
          fechaVencimiento,
          ahora,
        );
        const vigente = estadoEvaluacion === DD_ESTADOS_EVALUACION.VIGENTE;
        const puedeAvanzar =
          vigente &&
          (empresa.resultado === DD_RESULTADOS.APTO ||
            empresa.resultado === DD_RESULTADOS.APTO_CON_OBSERVACIONES);
        const mensaje =
          empresa.resultado === DD_RESULTADOS.NO_APTO
            ? "No habilitada para establecer vínculos con el IIMP."
            : empresa.resultado === DD_RESULTADOS.PENDIENTE
              ? "Debida diligencia pendiente de validación."
              : estadoEvaluacion === DD_ESTADOS_EVALUACION.REQUIERE_NUEVA_EVALUACION
                ? "La evaluación requiere una nueva evaluación."
                : empresa.resultado === DD_RESULTADOS.APTO_CON_OBSERVACIONES
                  ? "Apta con observaciones para el vínculo evaluado."
                  : "Debida diligencia vigente.";

        return {
          empresa: { ...empresa, fechaVencimiento },
          estadoEvaluacion,
          vigente,
          diasVigenciaRestantes: fechaVencimiento
            ? Math.max(0, dateUtils.diffInDays(ahora, fechaVencimiento) ?? 0)
            : null,
          puedeReservar: empresa.resultado !== DD_RESULTADOS.NO_APTO,
          puedeAvanzar,
          mensaje,
        };
      }),
    };
  }

  /**
   * Importa resultados manuales directamente a la DD interna.
   * Solo crea expedientes que aun no existen: un expediente iniciado por el
   * cliente nunca se actualiza desde la carga masiva.
   */
  async importarExpedientes(
    rows: Array<{
      empresaId: string;
      documento: string;
      razonSocial: string;
      estadoOrigen: string;
      resultado: string;
      motivoEvaluacion: string | null;
      eventoProyecto: string | null;
      fechaIngreso: Date | null;
      fechaRevision: Date | null;
      fechaVencimiento: Date | null;
    }>,
    meta: { archivo: string; hash: string; total: number; omitidos: number; errores: unknown },
    session: DdSession,
    eventoDestinoId?: string,
    catalogoEventos: DdEventoImportacionCatalogo[] = [],
  ): Promise<{ importados: number; actualizados: number; omitidos: number; loteId: string }> {
    this.exigirPermiso(session, PERMISSIONS.DD_VER);
    const eventoId = eventoDestinoId ?? this.eventoRequerido(session);
    const loteId = await this.repo.crearImportacion({
      archivo: meta.archivo,
      hash: meta.hash,
      eventoId,
      usuario: session.email,
      total: meta.total,
      omitidos: meta.omitidos,
      errores: meta.errores,
    });

    let importados = 0;
    let omitidos = 0;
    const anio = String(dateUtils.currentYear());
    const eventosResueltos = new Map<string, string>();
    const eventoFallback = eventoDestinoId ?? eventoId;

    for (const row of rows) {
      const eventoIdFila = await this.resolverEventoImportacion(
        row.eventoProyecto,
        row.fechaIngreso ?? row.fechaRevision,
        eventoFallback,
        eventosResueltos,
        catalogoEventos,
      );
      const existente = await this.repo.findExpedientePorEmpresaEvento(row.empresaId, eventoIdFila);
      if (existente) {
        omitidos += 1;
        continue;
      }
      const estado = this.estadoDesdeImportacion(row.resultado, row.estadoOrigen);
      const codigo = await this.repo.siguienteCodigo(anio);
      await this.repo.importarExpediente({
        empresaId: row.empresaId,
        eventoId: eventoIdFila,
        codigo,
        estado,
        estadoOrigen: row.estadoOrigen,
        eventoProyecto: row.eventoProyecto,
        motivoImportacion: row.motivoEvaluacion,
        importacionId: loteId,
        creadoPor: session.email,
        actualizadoPor: session.email,
        fechaEnvio: row.fechaIngreso,
        fechaRevision: row.fechaRevision,
        /* La aprobacion se registra cuando la DD figura APTA en la fuente. */
        fechaAprobacion: estado === DD_ESTADOS.APROBADA ? row.fechaRevision : null,
        fechaVencimiento: row.fechaVencimiento,
        fechaRechazo: estado === DD_ESTADOS.RECHAZADA ? (row.fechaRevision ?? row.fechaIngreso) : null,
      });
      importados += 1;
    }

    await this.repo.cerrarImportacion(loteId, importados, 0, omitidos + meta.omitidos);
    return { importados, actualizados: 0, omitidos, loteId };
  }

  /**
   * Resuelve la version de evento de una fila del CSV con el catalogo real de
   * eventos: primero por rango de fechas, luego por año y finalmente por la
   * version mas reciente de la familia. Siempre termina usando el id local del
   * evento, nunca un nombre o codigo como identificador persistido.
   */
  private async resolverEventoImportacion(
    eventoProyecto: string | null,
    fechaReferencia: Date | null,
    eventoFallback: string,
    cache: Map<string, string>,
    catalogo: DdEventoImportacionCatalogo[],
  ): Promise<string> {
    const normalizado = (eventoProyecto ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
    const tipoEvento = Object.entries(DD_IMPORT_EVENTO_TIPOS).find(([prefijo]) =>
      normalizado.startsWith(prefijo),
    )?.[1];
    if (!tipoEvento) return eventoFallback;

    const candidatos = catalogo.filter((evento) => evento.tipoEvento === tipoEvento);
    if (candidatos.length === 0) return eventoFallback;

    const anioReferencia = fechaReferencia?.getFullYear();
    const porFecha = fechaReferencia
      ? candidatos.find(
          (evento) =>
            evento.fechaInicio &&
            evento.fechaFin &&
            fechaReferencia >= evento.fechaInicio &&
            fechaReferencia <= evento.fechaFin,
        )
      : undefined;
    const porAnio = anioReferencia
      ? candidatos.find((evento) => evento.anio === String(anioReferencia))
      : undefined;
    const elegido =
      porFecha ??
      porAnio ??
      [...candidatos].sort((a, b) => b.anio.localeCompare(a.anio))[0];
    if (!elegido) return eventoFallback;

    const clave = `${elegido.tipoEvento}:${elegido.codigoEvento}`;
    const existente = cache.get(clave);
    if (existente) return existente;

    const evento = await this.authRepo.findOrCreateEvento(
      elegido.tipoEvento,
      elegido.codigoEvento,
    );
    await this.authRepo
      .renombrarEvento(evento.id, elegido.nombre, elegido.anio)
      .catch(() => undefined);
    cache.set(clave, evento.id);
    return evento.id;
  }

  private estadoDesdeImportacion(resultado: string, estadoOrigen: string): string {
    if (resultado === DD_RESULTADOS.APTO || resultado === DD_RESULTADOS.APTO_CON_OBSERVACIONES) {
      return DD_ESTADOS.APROBADA;
    }
    if (resultado === DD_RESULTADOS.NO_APTO) return DD_ESTADOS.RECHAZADA;
    const origen = estadoOrigen.trim().toUpperCase();
    if (origen.includes("OBSERV")) return DD_ESTADOS.OBSERVADA;
    if (origen.includes("REVIS") || origen.includes("PROCESO")) return DD_ESTADOS.EN_REVISION;
    return DD_ESTADOS.PENDIENTE;
  }

  /** Detalle de un expediente (staff o empresa duena). */
  async detalle(id: string, session: DdSession): Promise<DdExpedienteEntity> {
    return this.expedienteConAcceso(id, session);
  }

  /**
   * Regulariza una DD aprobada de otro evento adjuntando la declaracion de
   * vigencia, sin modificar su estado ni su vigencia.
   */
  async regularizarDeclaracionVigencia(
    dto: DdRegularizarVigenciaRequestDTO,
    session: DdSession,
  ): Promise<DdExpedienteEntity> {
    this.exigirPermiso(session, PERMISSIONS.DD_FORMULARIO);
    const empresaId = await this.empresaDelUsuario(session);
    const expediente = await this.repo.findExpedientePorId(dto.expedienteId);
    if (!expediente) {
      throw new DomainError("Expediente no encontrado", API_ERROR_CODES.NOT_FOUND, 404);
    }
    if (expediente.empresaId !== empresaId) {
      throw new DomainError("No puedes modificar este expediente", API_ERROR_CODES.FORBIDDEN, 403);
    }
    if (expediente.estado !== DD_ESTADOS.APROBADA) {
      throw new DomainError(
        "Solo se regulariza una DD aprobada",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
    if (expediente.eventoId === this.eventoRequerido(session)) {
      throw new DomainError(
        "Esta DD pertenece al evento activo; no requiere revalidación de vigencia.",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
    if (expediente.origen !== DD_ORIGENES.IMPORTADO) {
      throw new DomainError(
        "Solo las DD importadas de otro evento requieren declaración de vigencia",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
    if (
      ddUtils.estadoVigencia(
        expediente.estado,
        expediente.fechaVencimiento,
        undefined,
        expediente.fechaAprobacion,
      ) === DD_VIGENCIAS.VENCIDA
    ) {
      throw new DomainError("La DD ya no está vigente", API_ERROR_CODES.CONFLICT, 409);
    }
    const declaracion = expediente.documentos.find(
      (documento) => documento.tipo === DD_DOCUMENTOS.DECLARACION_VIGENCIA,
    );
    if (declaracion && declaracion.estado !== DD_DOCUMENTO_ESTADOS.OBSERVADO) {
      throw new DomainError(
        "La declaración de vigencia ya está cargada",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }

    await this.documentoValidator.validarDocumento({
      url: dto.url,
      nombre: dto.nombre,
      tipo: DD_DOCUMENTOS.DECLARACION_VIGENCIA,
    });

    const data: DdGuardarData = {
      tipoRelacionComercial: expediente.tipoRelacionComercial,
      actividadEconomica: expediente.actividadEconomica,
      actividadEconomicaOtro: expediente.actividadEconomicaOtro,
      paisConstitucion: expediente.paisConstitucion,
      sitioWeb: expediente.sitioWeb,
      emailRepresentante: expediente.emailRepresentante,
      aceptaDatos: expediente.aceptaDatos,
      aceptaVerificacion: expediente.aceptaVerificacion,
      declaraVerdad: expediente.declaraVerdad,
      representanteNombre: expediente.representanteNombre,
      representanteTipoDocumento: expediente.representanteTipoDocumento,
      representanteDocumento: expediente.representanteDocumento,
      representanteNacionalidad: expediente.representanteNacionalidad,
      beneficiarios: expediente.beneficiarios.map((beneficiario, orden) => ({
        orden,
        nombre: beneficiario.nombre,
        documento: beneficiario.documento,
        nacionalidad: beneficiario.nacionalidad,
        porcentaje: beneficiario.porcentaje,
      })),
      documentos: [
        ...expediente.documentos
          .filter((documento) => documento.tipo !== DD_DOCUMENTOS.DECLARACION_VIGENCIA)
          .map((documento) => ({
            tipo: documento.tipo,
            nombre: documento.nombre,
            url: documento.url,
            estado: documento.estado,
          })),
        {
          tipo: DD_DOCUMENTOS.DECLARACION_VIGENCIA,
          nombre: dto.nombre,
          url: dto.url,
          estado: DD_DOCUMENTO_ESTADOS.CARGADO,
        },
      ],
    };

    return this.repo.guardarFormulario(expediente.id, data, session.email);
  }

  /**
   * Revisa unicamente la declaracion de vigencia de una DD aprobada.
   * No modifica estado, fechaAprobacion ni fechaVencimiento del expediente.
   */
  private async revisarDeclaracionVigencia(
    expediente: DdExpedienteEntity,
    dto: DdRevisarRequestDTO,
    session: DdSession,
  ): Promise<DdExpedienteEntity> {
    if (expediente.origen !== DD_ORIGENES.IMPORTADO) {
      throw new DomainError(
        "Solo las DD importadas requieren revalidación de vigencia",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
    if (expediente.estado !== DD_ESTADOS.APROBADA) {
      throw new DomainError(
        "La declaración de vigencia solo se revisa en una DD aprobada",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
    if (expediente.eventoId === this.eventoRequerido(session)) {
      throw new DomainError(
        "La DD del evento activo no requiere revalidación de vigencia",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
    if (
      ddUtils.estadoVigencia(
        expediente.estado,
        expediente.fechaVencimiento,
        undefined,
        expediente.fechaAprobacion,
      ) === DD_VIGENCIAS.VENCIDA
    ) {
      throw new DomainError("La DD ya no está vigente", API_ERROR_CODES.CONFLICT, 409);
    }
    if (dto.accion === DD_ACCIONES_REVISION.RECHAZAR) {
      throw new DomainError(
        "La declaración de vigencia no se rechaza; se observa o se deriva la DD a Legal",
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }

    const declaracion = expediente.documentos.find(
      (documento) => documento.tipo === DD_DOCUMENTOS.DECLARACION_VIGENCIA,
    );
    if (dto.accion === DD_ACCIONES_REVISION.APROBAR) {
      if (!declaracion) {
        throw new DomainError(
          "La declaración de vigencia aún no está cargada",
          API_ERROR_CODES.CONFLICT,
          409,
        );
      }
      if (declaracion.estado !== DD_DOCUMENTO_ESTADOS.CARGADO) {
        throw new DomainError(
          "Solo se aprueba una declaración de vigencia cargada",
          API_ERROR_CODES.CONFLICT,
          409,
        );
      }
      await this.repo.marcarDeclaracionVigencia(
        expediente.id,
        DD_DOCUMENTO_ESTADOS.APROBADO,
        null,
      );
      await this.repo.resolverObservacionesDocumento(
        expediente.id,
        DD_DOCUMENTOS.DECLARACION_VIGENCIA,
      );
      await this.registrarHistorial(expediente.id, {
        tipo: DD_HISTORIAL_TIPOS.REVALIDACION_APROBADA,
        area: DD_OBSERVACION_AREAS.LOGISTICA,
        estado: expediente.estado,
        titulo: "Declaración de vigencia aprobada",
        detalle: "Logística validó la declaración sin modificar la vigencia original de la DD.",
        actor: session.email,
      });
      return (await this.repo.findExpedientePorId(expediente.id)) ?? expediente;
    }

    if (declaracion?.estado === DD_DOCUMENTO_ESTADOS.APROBADO) {
      throw new DomainError(
        "La declaración de vigencia ya está aprobada",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
    const texto =
      dto.motivo?.trim() ||
      dto.observaciones.find(
        (observacion) => observacion.documentoTipo === DD_DOCUMENTOS.DECLARACION_VIGENCIA,
      )?.texto.trim() ||
      "La declaración jurada de vigencia de información requiere corrección.";
    if (declaracion) {
      await this.repo.marcarDeclaracionVigencia(
        expediente.id,
        DD_DOCUMENTO_ESTADOS.OBSERVADO,
        texto,
      );
    }
    await this.repo.guardarObservacionDocumento(
      expediente.id,
      DD_DOCUMENTOS.DECLARACION_VIGENCIA,
      texto,
      session.email,
    );
    await this.registrarHistorial(expediente.id, {
      tipo: DD_HISTORIAL_TIPOS.REVALIDACION_OBSERVADA,
      area: DD_OBSERVACION_AREAS.LOGISTICA,
      estado: expediente.estado,
      titulo: "Declaración de vigencia observada",
      detalle: texto,
      actor: session.email,
    });
    return (await this.repo.findExpedientePorId(expediente.id)) ?? expediente;
  }

  /** Resolucion de Logistica: aprobar, observar o rechazar. */
  async revisar(dto: DdRevisarRequestDTO, session: DdSession): Promise<DdExpedienteEntity> {
    this.exigirPermiso(session, PERMISSIONS.DD_REVISION);
    const expediente = await this.repo.findExpedientePorId(dto.expedienteId);
    if (!expediente) throw new DomainError("Expediente no encontrado", API_ERROR_CODES.NOT_FOUND, 404);
    if (dto.alcance === DD_ALCANCES_REVISION.DECLARACION_VIGENCIA) {
      return this.revisarDeclaracionVigencia(expediente, dto, session);
    }
    const enRevision =
      expediente.estado === DD_ESTADOS.EN_REVISION || expediente.estado === DD_ESTADOS.OBSERVADA;
    const derivarExistente =
      (expediente.estado === DD_ESTADOS.APROBADA ||
        (expediente.estado === DD_ESTADOS.RECHAZADA && !expediente.decisionLegal)) &&
      dto.accion === DD_ACCIONES_REVISION.RECHAZAR;
    if (!enRevision && !derivarExistente) {
      throw new DomainError(
        expediente.estado === DD_ESTADOS.APROBADA
          ? "La debida diligencia ya está aprobada. Solo se puede derivar a revisión legal."
          : expediente.estado === DD_ESTADOS.RECHAZADA
            ? "La debida diligencia ya fue rechazada por Legal y no puede derivarse nuevamente."
            : "Solo se pueden revisar expedientes enviados a revisión u observados",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }

    if (
      dto.accion === DD_ACCIONES_REVISION.APROBAR &&
      (expediente.reputacion ?? []).some(
        (caso) =>
          caso.estado === DD_REPUTACION_ESTADOS.CON_HALLAZGOS ||
          caso.resultado === DD_REPUTACION_RESULTADOS.CON_HALLAZGOS,
      )
    ) {
      throw new DomainError(
        "No se puede aprobar la debida diligencia: Comunicaciones registró hallazgos reputacionales.",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }

    const ahora = dateUtils.now();
    const retornoLegal = expediente.decisionLegal === DD_ACCIONES_LEGAL.APROBAR;
    let actualizado: DdExpedienteEntity;

    if (dto.accion === DD_ACCIONES_REVISION.APROBAR) {
      await this.repo.resolverDocumentos(expediente.id, [], null);
      actualizado = await this.repo.actualizarEstado(expediente.id, {
        estado: DD_ESTADOS.APROBADA,
        fechaRevision: ahora,
        fechaAprobacion: ahora,
        fechaVencimiento: ddUtils.sumarMeses(ahora),
        revisadoPor: session.email,
        motivoRechazo: null,
        actualizadoPor: session.email,
      });
    } else if (dto.accion === DD_ACCIONES_REVISION.OBSERVAR) {
      const observaciones = dto.observaciones.length > 0
        ? dto.observaciones
        : dto.documentosObservados.length > 0
          ? dto.documentosObservados.map((tipo) => ({
              documentoTipo: tipo,
              texto: dto.motivo?.trim() || "El documento requiere una nueva versión.",
            }))
          : [
              {
                documentoTipo: null,
                texto: dto.motivo?.trim() || "El expediente requiere correcciones.",
              },
            ];
      await this.repo.crearObservaciones(
        expediente.id,
        observaciones.map((o) => ({
          area: DD_OBSERVACION_AREAS.LOGISTICA,
          documentoTipo: o.documentoTipo,
          texto: o.texto,
        })),
        session.email,
      );
      if (dto.documentosObservados.length > 0) {
        await this.repo.resolverDocumentos(
          expediente.id,
          dto.documentosObservados,
          dto.motivo,
        );
      }
      actualizado = await this.repo.actualizarEstado(expediente.id, {
        estado: DD_ESTADOS.OBSERVADA,
        fechaRevision: ahora,
        revisadoPor: session.email,
        actualizadoPor: session.email,
      });
    } else if (retornoLegal) {
      actualizado = await this.repo.actualizarEstado(expediente.id, {
        estado: DD_ESTADOS.RECHAZADA,
        fechaRevision: ahora,
        fechaRechazo: ahora,
        revisadoPor: session.email,
        motivoRechazo: dto.motivo,
        actualizadoPor: session.email,
      });
    } else {
      await this.repo.crearObservaciones(
        expediente.id,
        [
          {
            area: DD_OBSERVACION_AREAS.LEGAL,
            documentoTipo: null,
            texto: dto.motivo?.trim() || "Expediente rechazado por Logística.",
          },
        ],
        session.email,
      );
      actualizado = await this.repo.actualizarEstado(expediente.id, {
        estado: DD_ESTADOS.EN_LEGAL,
        fechaRevision: ahora,
        fechaDerivacionLegal: ahora,
        derivadoLegalPor: session.email,
        informeLogisticaUrl: dto.informeLogisticaUrl?.trim() || null,
        revisadoPor: session.email,
        motivoRechazo: dto.motivo,
        actualizadoPor: session.email,
      });
    }

    if (dto.accion === DD_ACCIONES_REVISION.APROBAR) {
      await this.registrarHistorial(actualizado.id, {
        tipo: DD_HISTORIAL_TIPOS.APROBACION,
        area: DD_OBSERVACION_AREAS.LOGISTICA,
        estado: actualizado.estado,
        titulo: "Debida diligencia aprobada",
        detalle: `Logística aprobó la evaluación. Vigente hasta ${dateUtils.format(actualizado.fechaVencimiento)}.`,
        actor: session.email,
      });
    } else if (retornoLegal) {
      await this.registrarHistorial(actualizado.id, {
        tipo: DD_HISTORIAL_TIPOS.RECHAZO,
        area: DD_OBSERVACION_AREAS.LEGAL,
        estado: actualizado.estado,
        titulo: "Debida diligencia rechazada",
        detalle: actualizado.motivoRechazo ?? "Rechazo final luego de la revisión legal.",
        actor: session.email,
      });
    } else if (actualizado.estado === DD_ESTADOS.EN_LEGAL) {
      await this.registrarHistorial(actualizado.id, {
        tipo: DD_HISTORIAL_TIPOS.DERIVACION_LEGAL,
        area: DD_OBSERVACION_AREAS.LOGISTICA,
        estado: actualizado.estado,
        titulo: "Expediente derivado a Legal",
        detalle: actualizado.motivoRechazo ?? "Logística derivó el expediente para revisión legal.",
        actor: session.email,
        metadata: {
          informeLogisticaUrl: actualizado.informeLogisticaUrl,
        },
      });
    }

    if (actualizado.estado === DD_ESTADOS.EN_LEGAL) {
      await this.notificaciones.notificarLegal({
        codigo: actualizado.codigo,
        razonSocial: actualizado.empresa.razonSocial,
        motivo: actualizado.motivoRechazo,
      });
    }

    const destino =
      actualizado.emailRepresentante ??
      actualizado.empresa.representanteCorreo ??
      actualizado.empresa.emailContacto;
    if (destino) {
      const datosBase = { to: destino, codigo: actualizado.codigo, razonSocial: actualizado.empresa.razonSocial };
      if (actualizado.estado === DD_ESTADOS.APROBADA) {
        await this.notificaciones.expedienteAprobado({
          ...datosBase,
          fechaVencimiento: actualizado.fechaVencimiento,
        });
      } else if (actualizado.estado === DD_ESTADOS.OBSERVADA) {
        const observacionesAbiertas = await this.repo.listarObservaciones(actualizado.id);
        await this.notificaciones.expedienteObservado({
          ...datosBase,
          observaciones: observacionesAbiertas
            .filter((o) => o.estado === DD_OBSERVACION_ESTADOS.ABIERTA)
            .map((o) => o.texto),
        });
      } else if (actualizado.estado === DD_ESTADOS.RECHAZADA) {
        await this.notificaciones.expedienteRechazado({
          ...datosBase,
          motivo: actualizado.motivoRechazo,
        });
      }
    }

    await this.repo.registrarAuditoria(
      `revision:${dto.accion}`,
      `debida_diligencia:${actualizado.codigo}`,
      session.email,
      `Logística resolvió la debida diligencia como ${actualizado.estado}`,
    );

    return actualizado;
  }

  /**
   * Deriva manualmente los nombres del expediente (empresa, representante y
   * beneficiarios) a la revision reputacional de Comunicaciones.
   */
  async derivarComunicaciones(dto: { expedienteId: string }, session: DdSession): Promise<{ derivados: number }> {
    this.exigirPermiso(session, PERMISSIONS.DD_REVISION);
    const expediente = await this.repo.findExpedientePorId(dto.expedienteId);
    if (!expediente) throw new DomainError("Expediente no encontrado", API_ERROR_CODES.NOT_FOUND, 404);
    const yaDerivado = await this.repo.tieneCasosReputacion(expediente.id);
    if (yaDerivado) {
      throw new DomainError("Los nombres ya fueron derivados a Comunicaciones", API_ERROR_CODES.CONFLICT, 409);
    }
    const nombres = ddUtils.nombresARevisar(expediente);
    if (nombres.length === 0) {
      throw new DomainError("El expediente no tiene nombres para derivar", API_ERROR_CODES.VALIDATION, 400);
    }
    await this.repo.crearCasosReputacion(
      expediente.id,
      nombres.map((nombre) => ({
        nombreARevisar: nombre,
        sitioWeb: expediente.sitioWeb,
        derivadoPor: session.email,
      })),
    );
    await this.repo.registrarAuditoria(
      "derivar-comunicaciones",
      `debida_diligencia:${expediente.codigo}`,
      session.email,
      `Logística derivó ${nombres.length} nombre(s) a Comunicaciones`,
    );
    await this.registrarHistorial(expediente.id, {
      tipo: DD_HISTORIAL_TIPOS.DERIVACION_COMUNICACIONES,
      area: DD_OBSERVACION_AREAS.COMUNICACION,
      estado: expediente.estado,
      titulo: "Revisión reputacional derivada",
      detalle: `Logística derivó ${nombres.length} nombre(s) a Comunicaciones.`,
      actor: session.email,
      metadata: { nombres: nombres.length },
    });
    return { derivados: nombres.length };
  }

  /** Panel del modulo: KPIs y agregados de vigencia/vinculo. */
  /** Decision final de Legal sobre un expediente derivado por Logistica. */
  async resolverLegal(
    dto: DdLegalResolucionData,
    session: DdSession,
  ): Promise<DdExpedienteEntity> {
    this.exigirPermiso(session, PERMISSIONS.DD_LEGAL);
    const expediente = await this.repo.findExpedientePorId(dto.expedienteId);
    if (!expediente) {
      throw new DomainError("Expediente no encontrado", API_ERROR_CODES.NOT_FOUND, 404);
    }
    if (expediente.estado !== DD_ESTADOS.EN_LEGAL) {
      throw new DomainError(
        "El expediente no está pendiente de revisión legal",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
    const informeLegalNombre = dto.informeLegalNombre?.trim() || null;
    const informeLegalUrl = dto.informeLegalUrl?.trim() || null;
    if (
      dto.decision === DD_ACCIONES_LEGAL.RECHAZAR &&
      (!informeLegalNombre || !informeLegalUrl)
    ) {
      throw new DomainError(
        "El informe legal es obligatorio para rechazar",
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    if (dto.decision === DD_ACCIONES_LEGAL.RECHAZAR && !dto.motivo?.trim()) {
      throw new DomainError(
        "El motivo del rechazo legal es obligatorio",
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    if (dto.decision === DD_ACCIONES_LEGAL.OBSERVAR && !dto.motivo?.trim()) {
      throw new DomainError(
        "El motivo de la observación legal es obligatorio",
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    if (informeLegalNombre && informeLegalUrl) {
      await this.documentoValidator.validarInformeLegal({
        url: informeLegalUrl,
        nombre: informeLegalNombre,
      });
    }

    const ahora = dateUtils.now();
    const aprobar = dto.decision === DD_ACCIONES_LEGAL.APROBAR;
    const observar = dto.decision === DD_ACCIONES_LEGAL.OBSERVAR;
    await this.repo.resolverObservaciones(expediente.id);
    if (observar) {
      const documentosObservados = dto.documentosObservados ?? [];
      if (documentosObservados.length > 0) {
        await this.repo.resolverDocumentos(
          expediente.id,
          documentosObservados,
          dto.motivo?.trim() || null,
        );
      }
      await this.repo.crearObservaciones(
        expediente.id,
        documentosObservados.length > 0
          ? documentosObservados.map((documentoTipo) => ({
              area: DD_OBSERVACION_AREAS.LEGAL,
              documentoTipo,
              texto: dto.motivo?.trim() || "Documento observado por Legal.",
            }))
          : [{
              area: DD_OBSERVACION_AREAS.LEGAL,
              documentoTipo: null,
              texto: dto.motivo?.trim() || "Observación de Legal.",
            }],
        session.email,
      );
    }

    const actualizado = await this.repo.actualizarEstado(expediente.id, {
      estado: observar
        ? DD_ESTADOS.OBSERVADA
        : aprobar
          ? DD_ESTADOS.EN_REVISION
          : DD_ESTADOS.RECHAZADA,
      fechaRevision: ahora,
      fechaLegal: ahora,
      legalRevisor: session.email,
      decisionLegal: dto.decision,
      motivoLegal: dto.motivo?.trim() || null,
      informeLegalNombre,
      informeLegalUrl,
      ...(observar || aprobar
        ? {
            fechaAprobacion: null,
            fechaVencimiento: null,
            fechaRechazo: null,
          }
        : { fechaAprobacion: null, fechaVencimiento: null, fechaRechazo: ahora }),
      actualizadoPor: session.email,
    });

    await this.repo.registrarAuditoria(
      `legal:${dto.decision}`,
      `debida_diligencia:${actualizado.codigo}`,
      session.email,
      observar
        ? "Legal observó la debida diligencia y devolvió el expediente al cliente"
        : aprobar
          ? "Legal aprobó la revisión y devolvió el expediente a Logística"
          : "Legal rechazó la debida diligencia con informe legal",
    );

    if (aprobar) {
      await this.registrarHistorial(actualizado.id, {
        tipo: DD_HISTORIAL_TIPOS.LEGAL_APROBACION,
        area: DD_OBSERVACION_AREAS.LEGAL,
        estado: actualizado.estado,
        titulo: "Revisión legal aprobada",
        detalle: "Legal aprobó la revisión y devolvió el expediente a Logística.",
        actor: session.email,
      });
    } else if (!observar) {
      await this.registrarHistorial(actualizado.id, {
        tipo: DD_HISTORIAL_TIPOS.LEGAL_RECHAZO,
        area: DD_OBSERVACION_AREAS.LEGAL,
        estado: actualizado.estado,
        titulo: "Debida diligencia rechazada por Legal",
        detalle: actualizado.motivoLegal ?? "Legal rechazó la debida diligencia.",
        actor: session.email,
        metadata: {
          informeLegalNombre: actualizado.informeLegalNombre,
          informeLegalUrl: actualizado.informeLegalUrl,
        },
      });
    }

    const destino =
      actualizado.emailRepresentante ??
      actualizado.empresa.representanteCorreo ??
      actualizado.empresa.emailContacto;
    if (destino && observar) {
      const observaciones = await this.repo.listarObservaciones(actualizado.id);
      await this.notificaciones.expedienteObservado({
        to: destino,
        codigo: actualizado.codigo,
        razonSocial: actualizado.empresa.razonSocial,
        observaciones: observaciones
          .filter((observacion) => observacion.estado === DD_OBSERVACION_ESTADOS.ABIERTA)
          .map((observacion) => observacion.texto),
      });
    } else if (destino && !aprobar) {
      await this.notificaciones.expedienteRechazado({
        to: destino,
        codigo: actualizado.codigo,
        razonSocial: actualizado.empresa.razonSocial,
        motivo: actualizado.motivoLegal ?? actualizado.motivoRechazo,
      });
    }

    return actualizado;
  }

  async panel(eventoId: string | undefined, session: DdSession): Promise<DdPanelData> {
    this.exigirPermiso(session, PERMISSIONS.DD_PANEL);
    return this.repo.resumenPanel(eventoId ?? this.eventoRequerido(session));
  }

  /** Matriz paginada de empresas del evento (panel). */
  async matriz(
    params: Omit<DdMatrizParams, "eventoId"> & { eventoId?: string },
    session: DdSession,
  ): Promise<DdMatrizResult> {
    this.exigirPermiso(session, PERMISSIONS.DD_PANEL);
    const eventoId = params.eventoId ?? this.eventoRequerido(session);
    return this.repo.listarMatriz({
      eventoId,
      page: Math.max(1, params.page),
      perPage: Math.min(DD_MATRIZ_PER_PAGE_MAX, Math.max(1, params.perPage)),
      search: params.search?.trim() || undefined,
      estado: params.estado,
      vinculo: params.vinculo,
      multiples: params.multiples,
    });
  }

  /** Bandeja de revision reputacional (Comunicaciones). */
  async reputacionListar(
    params: Omit<DdReputacionParams, "eventoId">,
    session: DdSession,
  ): Promise<DdReputacionResult> {
    this.exigirPermiso(session, PERMISSIONS.DD_REPUTACION);
    const eventoId = this.eventoRequerido(session);
    return this.repo.listarReputacion({
      eventoId,
      page: Math.max(1, params.page),
      perPage: Math.min(DD_PER_PAGE_MAX, Math.max(1, params.perPage)),
      search: params.search?.trim() || undefined,
      estado: params.estado,
    });
  }

  /** Guarda el resultado de la revision reputacional. */
  async reputacionResolver(dto: DdReputacionResolverRequestDTO, session: DdSession): Promise<void> {
    this.exigirPermiso(session, PERMISSIONS.DD_REPUTACION);
    const resultado = dto.resultado;
    const estadoFinal = ddUtils.estadoReputacion(resultado, dto.cerrar);
    if (!estadoFinal) throw new DomainError("Resultado inválido", API_ERROR_CODES.VALIDATION, 400);

    const actualizado = await this.repo.actualizarReputacion(dto.id, {
      estado: estadoFinal,
      resultado,
      comentario: dto.comentario?.trim() || null,
      linkHallazgos: resultado === DD_REPUTACION_RESULTADOS.CON_HALLAZGOS ? dto.linkHallazgos?.trim() || null : null,
      revisor: session.email,
      cerrar: dto.cerrar,
    });
    await this.repo.registrarAuditoria(
      "reputacion:resolver",
      `debida_diligencia_reputacion:${dto.id}`,
      session.email,
      `Comunicaciones registró el resultado ${resultado}${dto.cerrar ? " y cerró el caso" : ""}`,
    );
    if (dto.notificar) {
      await this.notificaciones.notificarLogistica(
        actualizado.derivadoPor,
        `Comunicaciones registró el resultado de la revisión reputacional: ${ddUtils.etiquetaReputacion(resultado)}.`,
        DD_RUTAS.BANDEJA,
      );
    }
  }
}
