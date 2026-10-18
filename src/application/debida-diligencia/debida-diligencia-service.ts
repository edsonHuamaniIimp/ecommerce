import "server-only";

import { DomainError } from "@/domain/errors/domain-error";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type {
  DdBandejaParams,
  DdBandejaResult,
  DdClientesParams,
  DdClientesResult,
  DdEmpresaResumen,
  DdExpedienteEntity,
  DdGuardarData,
  DdLegalResolucionData,
  DdMatrizParams,
  DdMatrizResult,
  DdPanelData,
  DdReputacionParams,
  DdReputacionResult,
} from "@/domain/models/debida-diligencia";
import type { IDebidaDiligenciaRepository } from "@/domain/ports/debida-diligencia-repository";
import type { IDebidaDiligenciaNotificacionPort } from "@/domain/ports/debida-diligencia-notificacion";
import type { IDebidaDiligenciaDocumentoValidator } from "@/domain/ports/debida-diligencia-documento-validator";
import type {
  DdGuardarRequestDTO,
  DdReputacionResolverRequestDTO,
  DdRevisarRequestDTO,
} from "@/types/dto/debida-diligencia";
import {
  API_ERROR_CODES,
  DD_ACCIONES_LEGAL,
  DD_ACCIONES_REVISION,
  DD_DOCUMENTO_ESTADOS,
  DD_ESTADOS,
  DD_ESTADOS_EVALUACION,
  DD_OBSERVACION_AREAS,
  DD_OBSERVACION_ESTADOS,
  DD_MATRIZ_PER_PAGE_MAX,
  DD_DOCUMENTOS_REQUERIDOS,
  DD_PER_PAGE_MAX,
  DD_RUTAS,
  PERMISSIONS,
  ROLES,
  type DdDocumentoTipo,
} from "@/lib/shared/constants";
import { ddUtils } from "@/lib/shared/utils/debida-diligencia";
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

  /** Expediente de la empresa del usuario para el evento activo. */
  async obtenerMiExpediente(session: DdSession): Promise<DdMiExpedienteResultado> {
    this.exigirPermiso(session, PERMISSIONS.DD_FORMULARIO);
    const empresaId = await this.empresaDelUsuario(session);
    const eventoId = this.eventoRequerido(session);
    const [expediente, empresa] = await Promise.all([
      this.repo.findExpedientePorEmpresaEvento(empresaId, eventoId),
      this.repo.findEmpresaResumen(empresaId),
    ]);
    return { expediente, empresa };
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
            ? "La debida diligencia aprobada no se puede editar. Contacta al IIMP para renovarla."
            : "El expediente fue rechazado y no admite nuevas modificaciones.";
      throw new DomainError(mensaje, API_ERROR_CODES.CONFLICT, 409);
    }

    const data: DdGuardarData = {
      tipoRelacionComercial: dto.tipoRelacionComercial ?? null,
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

    const tiposPermitidos = new Set(DD_DOCUMENTOS_REQUERIDOS.map((d) => d.tipo));
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
      estado: DD_ESTADOS.EN_REVISION,
      fechaEnvio: dateUtils.now(),
      actualizadoPor: session.email,
    });
    await this.repo.registrarAuditoria(
      "enviar",
      `debida_diligencia:${actualizado.codigo}`,
      session.email,
      "El cliente envió la debida diligencia a revisión",
    );

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
  async bandeja(params: Omit<DdBandejaParams, "eventoId">, session: DdSession): Promise<DdBandejaResult> {
    this.exigirPermiso(session, PERMISSIONS.DD_REVISION);
    const eventoId = this.eventoRequerido(session);
    return this.repo.listarBandeja({
      eventoId,
      page: Math.max(1, params.page),
      perPage: Math.min(DD_PER_PAGE_MAX, Math.max(1, params.perPage)),
      search: params.search?.trim() || undefined,
      estado: params.estado,
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
      page: Math.max(1, params.page),
      perPage: Math.min(DD_PER_PAGE_MAX, Math.max(1, params.perPage)),
      search: params.search?.trim() || undefined,
      estado: DD_ESTADOS.EN_LEGAL,
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
        );
        return {
          expediente,
          resultado: resultadoEvaluacion,
          estadoEvaluacion,
          vigente: estadoEvaluacion === DD_ESTADOS_EVALUACION.VIGENTE,
          diasVigenciaRestantes: ddUtils.diasVigenciaRestantes(
            expediente.estado,
            expediente.fechaVencimiento,
          ),
          aptoParaContratar: ddUtils.aptoParaContratar(
            resultadoEvaluacion,
            estadoEvaluacion,
            expediente.declaraVerdad,
          ),
          alcance: ddUtils.alcanceResultado(resultadoEvaluacion),
          observacionesAbiertas,
        };
      }),
    };
  }

  /** Detalle de un expediente (staff o empresa duena). */
  async detalle(id: string, session: DdSession): Promise<DdExpedienteEntity> {
    return this.expedienteConAcceso(id, session);
  }

  /** Resolucion de Logistica: aprobar, observar o rechazar. */
  async revisar(dto: DdRevisarRequestDTO, session: DdSession): Promise<DdExpedienteEntity> {
    this.exigirPermiso(session, PERMISSIONS.DD_REVISION);
    const expediente = await this.repo.findExpedientePorId(dto.expedienteId);
    if (!expediente) throw new DomainError("Expediente no encontrado", API_ERROR_CODES.NOT_FOUND, 404);
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
        revisadoPor: session.email,
        motivoRechazo: dto.motivo,
        actualizadoPor: session.email,
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

    if (dto.derivarComunicaciones) {
      const yaDerivado = await this.repo.tieneCasosReputacion(expediente.id);
      if (!yaDerivado) {
        const nombres = ddUtils.nombresARevisar(expediente);
        await this.repo.crearCasosReputacion(
          expediente.id,
          nombres.map((nombre) => ({
            nombreARevisar: nombre,
            sitioWeb: expediente.sitioWeb,
            derivadoPor: session.email,
          })),
        );
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
    if (informeLegalNombre && informeLegalUrl) {
      await this.documentoValidator.validarInformeLegal({
        url: informeLegalUrl,
        nombre: informeLegalNombre,
      });
    }

    const ahora = dateUtils.now();
    const aprobar = dto.decision === DD_ACCIONES_LEGAL.APROBAR;
    await this.repo.resolverObservaciones(expediente.id);

    const actualizado = await this.repo.actualizarEstado(expediente.id, {
      estado: aprobar ? DD_ESTADOS.EN_REVISION : DD_ESTADOS.RECHAZADA,
      fechaRevision: ahora,
      fechaLegal: ahora,
      legalRevisor: session.email,
      decisionLegal: dto.decision,
      motivoLegal: dto.motivo?.trim() || null,
      informeLegalNombre,
      informeLegalUrl,
      ...(aprobar
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
      aprobar
        ? "Legal aprobó la revisión y devolvió el expediente a Logística"
        : "Legal rechazó la debida diligencia con informe legal",
    );

    if (!aprobar) {
      const destino =
        actualizado.emailRepresentante ??
        actualizado.empresa.representanteCorreo ??
        actualizado.empresa.emailContacto;
      if (destino) {
        await this.notificaciones.expedienteRechazado({
          to: destino,
          codigo: actualizado.codigo,
          razonSocial: actualizado.empresa.razonSocial,
          motivo: actualizado.motivoLegal ?? actualizado.motivoRechazo,
        });
      }
    }

    return actualizado;
  }

  async panel(session: DdSession): Promise<DdPanelData> {
    this.exigirPermiso(session, PERMISSIONS.DD_PANEL);
    const eventoId = this.eventoRequerido(session);
    return this.repo.resumenPanel(eventoId);
  }

  /** Matriz paginada de empresas del evento (panel). */
  async matriz(params: Omit<DdMatrizParams, "eventoId">, session: DdSession): Promise<DdMatrizResult> {
    this.exigirPermiso(session, PERMISSIONS.DD_PANEL);
    const eventoId = this.eventoRequerido(session);
    return this.repo.listarMatriz({
      eventoId,
      page: Math.max(1, params.page),
      perPage: Math.min(DD_MATRIZ_PER_PAGE_MAX, Math.max(1, params.perPage)),
      search: params.search?.trim() || undefined,
      estado: params.estado,
      vinculo: params.vinculo,
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
