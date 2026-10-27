import type { ISolicitudesRepository, SolicitudesListParams, SolicitudesPaginatedResult } from "@/domain/ports/solicitudes-repository";
import type { SolicitudRow, RevisionEntity } from "@/domain/models/entities";
import { createHash } from "node:crypto";
import type { StorageAdapter } from "@/lib/server/storage";
import { REVISION_AREAS, RESULTADOS_APROBACION, ROLES, PERMISSIONS, API_ERROR_CODES, REVISION_AREA_NEXT_ROLE, SGC_TRIGGER_REVISION_AREA, TIPOS_DOCUMENTO_SOLICITUD, ALERTA_TIPOS, ANEXOS_REQUERIDOS, ESTADOS_SOLICITUD, ESTADOS_DOCUMENTO_SOLICITUD, extensionesPermitidasAnexo, type TipoDocumentoSolicitud } from "@/lib/shared/constants";
import { getAppUrl } from "@/lib/server/app-url";
import { DomainError } from "@/lib/server/router";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import { dateUtils } from "@/lib/shared/utils/date";
import { puedeClienteSubirDocumentos, enVentanaAnexosReserva } from "@/lib/shared/utils/solicitud-documentos";
import { areasRevisionLocal } from "@/lib/shared/utils/revision-areas";
import { isSgcEnabled } from "@/lib/server/sgc-config";
import { enviarEmailPlantilla } from "@/lib/server/email";
import { ALERTA_CLAVES } from "@/lib/shared/alert-templates";
import type { JwtPayload } from "@/lib/server/auth";
import type { ModoNotificacion } from "@/lib/shared/constants";
import type { SgcIntegracionApplicationService } from "@/application/sgc-integracion/sgc-integracion-service";

export class SolicitudesApplicationService {
  readonly repo: ISolicitudesRepository;

  constructor(
    repo: ISolicitudesRepository,
    private readonly sgcIntegracion?: SgcIntegracionApplicationService,
    private readonly storage?: StorageAdapter,
  ) {
    this.repo = repo;
  }

  async listar(params: SolicitudesListParams): Promise<SolicitudesPaginatedResult> {
    return this.repo.listar(params);
  }

  async detalle(solicitudId: string): Promise<SolicitudRow | null> {
    return this.repo.detalle(solicitudId);
  }

  /**
   * Notificacion manual del resultado de revision al cliente (desde la bandeja).
   * La autorizacion se decide aqui (doble validacion JWT + BD), no en el controlador.
   */
  async notificarCliente(
    params: {
      solicitudId: string;
      to: string;
      modo: ModoNotificacion;
      mensaje?: string;
      /** Idioma del destinatario ya resuelto (capa web). */
      idioma: string | null;
    },
    session: JwtPayload,
  ): Promise<void> {
    await this.autorizarNotificacion(session);

    const detalle = await this.detalle(params.solicitudId);
    if (!detalle) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);

    const faltaRevision = areasRevisionLocal(detalle.revisiones, { sgcEnabled: isSgcEnabled() }).some(
      (area) =>
        (detalle.revisiones.find((r) => r.area === area)?.estado ?? RESULTADOS_APROBACION.PENDIENTE) ===
        RESULTADOS_APROBACION.PENDIENTE,
    );
    if (faltaRevision) {
      throw new DomainError("Faltan revisiones pendientes", API_ERROR_CODES.CONFLICT, 409);
    }

    const nombreUsuario = detalle.userId
      ? (await this.repo.findNombreUsuario(detalle.userId)) ?? "Estimad@"
      : "Estimad@";

    const enviado = await enviarEmailPlantilla({
      to: params.to,
      plantilla: "revision-resultado",
      idioma: params.idioma,
      datos: {
        standCode: detalle.standCode,
        empresa: detalle.empresa ?? "-",
        nombre: nombreUsuario,
        email: detalle.email ?? params.to,
        gessStandId: detalle.id,
        modo: params.modo,
        mensaje: params.mensaje,
        revisiones: detalle.revisiones.map((r) => ({ area: r.area, estado: r.estado, comentario: r.comentario })),
      },
    });
    if (!enviado) throw new DomainError("Error al enviar el correo", API_ERROR_CODES.INTERNAL, 500);
  }

  /** Permiso de notificacion: JWT + revalidacion en BD (permisos pueden cambiar). */
  private async autorizarNotificacion(session: JwtPayload): Promise<void> {
    if (
      !session.permissions.includes(PERMISSIONS.SOLICITUDES_NOTIFY) &&
      !session.permissions.includes(PERMISSIONS.ADMIN_FULL)
    ) {
      throw new DomainError("Sin permisos para notificar", API_ERROR_CODES.FORBIDDEN, 403);
    }
    const { hasDBPermission } = await import("@/lib/server/auth");
    if (!(await hasDBPermission(session, PERMISSIONS.SOLICITUDES_NOTIFY))) {
      throw new DomainError("Permiso revocado. Cierra sesion y vuelve a ingresar.", API_ERROR_CODES.FORBIDDEN, 403);
    }
  }

  async revisar(data: {
    solicitudId: string;
    area: string;
    estado: string;
    comentario?: string;
    /** Documentos (IDs) que el Asociado observa; solo aplica a estado "observado". */
    documentosObservados?: string[];
    reviewerEmail: string;
  }): Promise<RevisionEntity> {
    if (!Object.values(REVISION_AREAS).includes(data.area as never)) {
      throw new Error(`Area invalida: ${data.area}`);
    }
    if (!Object.values(RESULTADOS_APROBACION).includes(data.estado as never)) {
      throw new Error(`Estado invalido: ${data.estado}`);
    }

    /*
     * Observacion de documentos (solo Asociado): exige justificacion y al menos un
     * documento vigente; los documentos pasan a estado `observado` (baja logica por
     * estado, nunca se eliminan), la solicitud queda `observado` y el cliente recibe
     * alerta + correo con el detalle.
     */
    if (data.estado === RESULTADOS_APROBACION.OBSERVADO) {
      if (data.area !== SGC_TRIGGER_REVISION_AREA) {
        throw new DomainError("Solo el area Asociado puede observar documentos", API_ERROR_CODES.VALIDATION, 400);
      }
      const motivo = String(data.comentario ?? "").trim();
      if (!motivo) {
        throw new DomainError("La justificacion es obligatoria para observar documentos", API_ERROR_CODES.VALIDATION, 400);
      }
      const docIds = [...new Set(data.documentosObservados ?? [])];
      if (docIds.length === 0) {
        throw new DomainError("Selecciona al menos un documento para observar", API_ERROR_CODES.VALIDATION, 400);
      }
      const detalle = await this.repo.detalle(data.solicitudId);
      if (!detalle) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
      const vigentes = detalle.docsAdjuntos.filter(
        (d) =>
          docIds.includes(d.id) &&
          d.userId !== null &&
          (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO),
      );
      if (vigentes.length !== docIds.length) {
        throw new DomainError(
          "Solo puedes observar documentos vigentes subidos por el cliente",
          API_ERROR_CODES.CONFLICT,
          409,
        );
      }
      const marcados = await this.repo.observarDocumentos(data.solicitudId, docIds, motivo, data.reviewerEmail);
      if (marcados !== docIds.length) {
        throw new DomainError("No se pudieron observar todos los documentos (recarga e intenta de nuevo)", API_ERROR_CODES.CONFLICT, 409);
      }

      const revision = await this.repo.crearOActualizarRevision({ ...data, comentario: motivo });

      /*
       * La observacion aplica solo a documentos del cliente; el contrato del
       * administrador es solo lectura para el revisor.
       */

      /* Notificacion al cliente: campana + correo con el detalle de la observacion. */
      const etiquetaDoc = (docId: string): string => {
        const doc = detalle.docsAdjuntos.find((d) => d.id === docId);
        if (!doc) return docId;
        return ANEXOS_REQUERIDOS.find((a) => a.key === doc.requisito)?.label ?? doc.nombre;
      };
      const documentos = docIds.map(etiquetaDoc);
      if (detalle.userId) {
        await this.repo.crearAlertaReserva({
          userId: detalle.userId,
          tipo: ALERTA_TIPOS.DOCUMENTOS_OBSERVADOS,
          clave: ALERTA_CLAVES.DOCUMENTOS_OBSERVADOS,
          datos: { stands: detalle.standCode, total: docIds.length },
          url: `/dashboard/mis-solicitudes?solicitud=${data.solicitudId}`,
        }).catch(() => {});
      }
      if (detalle.email) {
        await enviarEmailPlantilla({
          to: detalle.email,
          plantilla: "documentos-observados",
          idioma: null,
          datos: {
            standCodes: detalle.standCode,
            documentos,
            justificacion: motivo,
            url: `${getAppUrl()}/dashboard/mis-solicitudes?solicitud=${data.solicitudId}`,
          },
        }).catch(() => false);
      }

      /* La observacion detiene el flujo: no se alerta al siguiente revisor. */
      return revision;
    }

    const revision = await this.repo.crearOActualizarRevision(data);

    // Only send alerts when transitioning FROM pendiente (first review)
    if (!revision.fuePrimeraRevision) return revision;

    const sgcHabilitado = isSgcEnabled();
    if (sgcHabilitado && data.area === SGC_TRIGGER_REVISION_AREA && data.estado === RESULTADOS_APROBACION.APROBADO) {
      await this.sgcIntegracion?.crearExpedienteDesdeSolicitud(data.solicitudId);
      /* Envio automatico al SGC (contrato + anexos + revision): el admin ya no necesita pulsar
       * "Enviar al SGC para revisión". Best-effort: no rompe la aprobacion si el SGC falla. */
      await this.sgcIntegracion?.enviarExpedienteAlSgc(data.solicitudId, data.reviewerEmail);
    }
    const nextRole = !sgcHabilitado && data.area === REVISION_AREAS.ASOCIADO && data.estado === RESULTADOS_APROBACION.APROBADO
      ? ROLES.LEGAL
      : REVISION_AREA_NEXT_ROLE[data.area as keyof typeof REVISION_AREA_NEXT_ROLE];
    if (nextRole) {
      const detalle = await this.repo.detalle(data.solicitudId);
      if (detalle) {
        await this.repo.crearAlertaRevision({
          rol: nextRole,
          solicitudId: data.solicitudId,
          clave: ALERTA_CLAVES.TURNO_REVISION,
          datos: { area: data.area, stands: detalle.standCode },
        }).catch(() => {});
      }
    } else {
      const detalle = await this.repo.detalle(data.solicitudId);
      if (detalle) {
        await this.repo.crearAlertaRevision({
          rol: ROLES.ADMIN,
          solicitudId: data.solicitudId,
          clave: ALERTA_CLAVES.REVISION_COMPLETADA,
          datos: { stands: detalle.standCode },
        }).catch(() => {});
      }
    }

    return revision;
  }

  async inicializarRevisiones(solicitudId: string): Promise<void> {
    for (const area of areasRevisionLocal([], { sgcEnabled: isSgcEnabled() })) {
      await this.repo.crearRevisionInicial(solicitudId, area);
    }
  }

  /**
   * Habilita al cliente la firma del contrato. Es solo un habilitador:
   * no genera contrato, no cambia el estado de la solicitud ni las revisiones.
   */
  async habilitarContrato(solicitudId: string): Promise<void> {
    const detalle = await this.repo.detalle(solicitudId);
    if (!detalle) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    if (
      detalle.estadoSolicitud !== ESTADOS_SOLICITUD.PENDIENTE &&
      detalle.estadoSolicitud !== ESTADOS_SOLICITUD.OBSERVADO
    ) {
      throw new DomainError(
        "La solicitud ya no admite habilitar la firma del contrato",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
    if (detalle.contratoHabilitado === true) return;
    await this.repo.habilitarContrato(solicitudId);
  }

  /**
   * Reenvio tras una observacion local (cliente): exige que TODOS los documentos
   * observados tengan una nueva version vigente del mismo requisito/categoria y,
   * si es asi, los pasa a `reemplazado` (historial), reinicia la revision del
   * Asociado a pendiente y alerta a los revisores. No elimina nada.
   */
  async reenviarObservacion(solicitudId: string, userSub: string, userEmail: string): Promise<void> {
    const detalle = await this.repo.detalle(solicitudId);
    if (!detalle) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    if (detalle.userId !== userSub) {
      throw new DomainError("No puedes reenviar una solicitud ajena", API_ERROR_CODES.FORBIDDEN, 403);
    }
    if (detalle.estadoSolicitud !== ESTADOS_SOLICITUD.OBSERVADO) {
      throw new DomainError("La solicitud no esta observada", API_ERROR_CODES.CONFLICT, 409);
    }

    /*
     * Normalmente los observados siguen en estado `observado`. Si el contrato
     * observado fue regenerado automaticamente, el documento original ya paso a
     * `reemplazado` (conservando el motivo): se usa como referencia del ciclo para
     * poder validar la firma y reenviar.
     */
    const observadosActuales = detalle.docsAdjuntos.filter((d) => d.estado === ESTADOS_DOCUMENTO_SOLICITUD.OBSERVADO);
    const observados = observadosActuales.length > 0
      ? observadosActuales
      : detalle.docsAdjuntos.filter(
          (d) => d.estado === ESTADOS_DOCUMENTO_SOLICITUD.REEMPLAZADO && Boolean(d.motivoObservacion),
        );
    if (observados.length === 0) {
      throw new DomainError("No hay documentos observados pendientes de reemplazo", API_ERROR_CODES.CONFLICT, 409);
    }

    const etiquetaDoc = (doc: (typeof observados)[number]): string =>
      ANEXOS_REQUERIDOS.find((a) => a.key === doc.requisito)?.label ?? doc.nombre;
    const faltantes: string[] = [];
    for (const obs of observados) {
      const reemplazo = detalle.docsAdjuntos.some((d) =>
        (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO) &&
        (d.categoria ?? null) === (obs.categoria ?? null) &&
        (d.requisito ?? null) === (obs.requisito ?? null) &&
        dateUtils.isAfter(d.createdAt, obs.createdAt));
      if (!reemplazo) faltantes.push(etiquetaDoc(obs));
    }

    /*
     * Si se observo el contrato del administrador, ademas de existir la version
     * corregida, el cliente debe firmarla: el reenvio exige un `contrato_firmado`
     * vigente posterior a ese contrato corregido.
     */
    const contratoAdminObservado = observados.some(
      (d) => d.userId === null && d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
    );
    if (contratoAdminObservado) {
      const ordenDesc = (a: { createdAt: Date }, b: { createdAt: Date }) =>
        (dateUtils.toMs(b.createdAt) ?? 0) - (dateUtils.toMs(a.createdAt) ?? 0);
      const adminVigente = detalle.docsAdjuntos
        .filter((d) => (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO) &&
          d.userId === null && d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO)
        .sort(ordenDesc)[0];
      if (adminVigente) {
        const firmadoVigente = detalle.docsAdjuntos
          .filter((d) => (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO) &&
            d.userId === userSub && d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO)
          .sort(ordenDesc)[0];
        const firmadoOk = firmadoVigente
          ? dateUtils.isAfter(firmadoVigente.createdAt, adminVigente.createdAt)
          : false;
        if (!firmadoOk) faltantes.push("Contrato firmado (version corregida)");
      }
    }

    if (faltantes.length > 0) {
      throw new DomainError(`Faltan las nuevas versiones de: ${faltantes.join(", ")}`, API_ERROR_CODES.CONFLICT, 409);
    }

    /* Historial: los observados ya reemplazados no vuelven a contar como vigentes. */
    await this.repo.marcarDocumentosReemplazadosPorIds(solicitudId, observados.map((d) => d.id));

    /* Vuelve a la cola de revision del Asociado (queda registrado en el historial). */
    await this.repo.crearOActualizarRevision({
      solicitudId,
      area: REVISION_AREAS.ASOCIADO,
      estado: RESULTADOS_APROBACION.PENDIENTE,
      comentario: undefined,
      reviewerEmail: userEmail,
    });

    await this.repo.crearAlertaRevision({
      rol: ROLES.ASOCIADO,
      solicitudId,
      clave: ALERTA_CLAVES.TURNO_REVISION,
      datos: { area: REVISION_AREAS.ASOCIADO, stands: detalle.standCode },
    }).catch(() => {});
  }

  async uploadDocumento(params: {
    solicitudId: string;
    url: string;
    nombre: string;
    userSub: string;
    userEmail: string;
    userPermissions: string[];
    tipo?: string;
    /** Requisito del anexo (clave de ANEXOS_REQUERIDOS); RF-13. */
    requisito?: string | null;
    /** Eventos con contrato posterior: permite anexos iniciales de la reserva. */
    permitirAnexosIniciales?: boolean;
    /** True solo cuando el archivo firmado lo genera la firma digital del servidor. */
    firmaDigital?: boolean;
  }): Promise<Record<string, unknown>> {
    const isAdmin = params.userPermissions.includes(PERMISSIONS.ADMIN_FULL) || params.userPermissions.includes(PERMISSIONS.SOLICITUDES_UPLOAD);

    /*
     * El cliente solo puede adjuntar documentos mientras la solicitud este en el
     * paso Legal (SGC) y aun no se hayan enviado documentos al SGC. El admin no
     * tiene esta restriccion (adjunta el contrato v1 / anexos en el paso Legal).
     */
    if (!isAdmin) {
      const detalle = await this.repo.detalle(params.solicitudId);
      if (!detalle) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
      if (detalle.userId !== params.userSub) {
        throw new DomainError("No puedes adjuntar documentos a esta solicitud", API_ERROR_CODES.FORBIDDEN, 403);
      }
      /*
       * Politica fija: el cliente solo puede firmar digitalmente. Se rechaza
       * cualquier subida manual de un contrato firmado.
       */
      if (
        params.tipo === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO &&
        params.firmaDigital !== true
      ) {
        throw new DomainError(
          "Este contrato solo permite firma digital; no se admite subir un contrato firmado manualmente.",
          API_ERROR_CODES.CONFLICT,
          409,
        );
      }
      if (
        !puedeClienteSubirDocumentos(detalle) &&
        !(params.permitirAnexosIniciales === true &&
          enVentanaAnexosReserva(detalle) &&
          params.tipo === TIPOS_DOCUMENTO_SOLICITUD.ANEXO)
      ) {
        throw new DomainError(
          "Aún no puedes adjuntar documentos. Se habilita al llegar a la revisión Legal (SGC) y se cierra cuando ya se enviaron al SGC.",
          API_ERROR_CODES.CONFLICT,
          409,
        );
      }
    }

    /*
     * Clasificacion del documento adjunto:
     *  - CONTRATO: contrato v1 subido por el administrador (`userId` null).
     *  - CONTRATO_FIRMADO: contrato firmado subido por el cliente (`userId` propio).
     *  - ANEXO: documento anexo del cliente para el SGC (`userId` propio).
     * Sin tipo (legacy): el admin queda como `userId` null y el cliente como propio.
     */
    const tipoValido = Object.values(TIPOS_DOCUMENTO_SOLICITUD).includes(params.tipo as TipoDocumentoSolicitud)
      ? (params.tipo as TipoDocumentoSolicitud)
      : null;

    const categoria = tipoValido ?? null;
    /*
     * Requisito del anexo (Ficha RUC / Vigencia de Poderes / DNI del representante):
     * solo aplica a documentos ANEXO del cliente y debe ser una clave valida.
     */
    let requisito: string | null = null;
    if (params.requisito && tipoValido === TIPOS_DOCUMENTO_SOLICITUD.ANEXO) {
      if (!ANEXOS_REQUERIDOS.some((a) => a.key === params.requisito)) {
        throw new DomainError(
          `Requisito de anexo invalido: ${params.requisito}`,
          API_ERROR_CODES.VALIDATION,
          400,
        );
      }
      /*
       * Formatos por requisito (RF-13): Ficha RUC y Vigencia de Poder solo PDF;
       * DNI o Pasaporte tambien acepta imagen (PNG/JPG). La regla vive en
       * constantes y se valida tanto en el cliente como aqui (backend).
       */
      const extensiones = extensionesPermitidasAnexo(params.requisito);
      if (!archivoUtils.extensionPermitida(params.url, extensiones)) {
        throw new DomainError(
          `Formato no permitido: el anexo solo admite ${extensiones.map((e) => e.toUpperCase()).join(", ")}`,
          API_ERROR_CODES.VALIDATION,
          400,
        );
      }
      requisito = params.requisito;
    }
    let userId: string | null;
    if (tipoValido === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO) {
      userId = null;
    } else if (tipoValido === TIPOS_DOCUMENTO_SOLICITUD.ANEXO || tipoValido === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO) {
      userId = params.userSub;
    } else {
      userId = isAdmin ? null : params.userSub;
    }

    /*
     * Un contrato firmado debe ser el de ESTA solicitud: se rechaza reutilizar el
     * mismo archivo (mismo SHA-256) ya adjuntado como firmado en otra solicitud
     * (evita cruzar reservas). Solo aplica a archivos servidos por /uploads.
     */
    let sha256Firmado: string | null = null;
    if (tipoValido === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO && this.storage && params.url.startsWith("/uploads/")) {
      const archivo = await this.storage.read(params.url.replace(/^\/uploads\//, "")).catch(() => null);
      if (archivo) {
        sha256Firmado = createHash("sha256").update(archivo.bytes).digest("hex");
        const enOtra = await this.repo.findDocumentoPorHashEnOtraSolicitud(sha256Firmado, params.solicitudId);
        if (enOtra) {
          throw new DomainError(
            "Este archivo firmado ya fue adjuntado a otra solicitud. Descarga el contrato de ESTA solicitud, firmalo y subelo.",
            API_ERROR_CODES.CONFLICT,
            409,
          );
        }
      }
    }

    /*
     * Nueva version del cliente: la version vigente del mismo requisito/categoria
     * pasa a `reemplazado` (historial). Nunca se elimina fisicamente.
     */
    if (!isAdmin && categoria) {
      await this.repo.marcarDocumentosReemplazados(params.solicitudId, params.userSub, categoria, requisito);
    }

    const doc = await this.repo.crearDocumentoAdjunto(
      params.solicitudId, params.url, params.nombre,
      userId,
      params.userEmail,
      categoria,
      requisito,
      sha256Firmado,
    );

    /*
     * Avance del flujo: cuando el cliente sube el contrato firmado, se avisa al
     * admin para que proceda con la revision de las areas. Best-effort: un fallo
     * de la alerta no revierte la subida.
     */
    if (tipoValido === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO) {
      try {
        const detalle = await this.repo.detalle(params.solicitudId);
        if (detalle) {
          await this.repo.crearAlertaRol({
            rol: ROLES.ADMIN,
            tipo: ALERTA_TIPOS.CONTRATO_FIRMADO,
            clave: ALERTA_CLAVES.CONTRATO_FIRMADO_SUBIDO,
            datos: { stands: detalle.standCode },
            url: `${getAppUrl()}/dashboard/solicitudes?id=${params.solicitudId}`,
          });
        }
      } catch { /* best-effort */ }
    }

    return doc;
  }

  /**
   * RF-08: guarda la URL de la imagen (PNG) del recorte del pabellon de una solicitud.
   * Solo el titular de la solicitud o un admin pueden guardarla.
   */
  async guardarRecortePlano(params: {
    solicitudId: string;
    url: string;
    userSub: string;
    userPermissions: string[];
  }): Promise<void> {
    const detalle = await this.repo.detalle(params.solicitudId);
    if (!detalle) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    const isAdmin =
      params.userPermissions.includes(PERMISSIONS.ADMIN_FULL) ||
      params.userPermissions.includes(PERMISSIONS.SOLICITUDES_UPLOAD);
    if (!isAdmin && detalle.userId !== params.userSub) {
      throw new DomainError("No puedes guardar la imagen de esta solicitud", API_ERROR_CODES.FORBIDDEN, 403);
    }
    await this.repo.guardarRecortePlano(params.solicitudId, params.url);
  }

  async eliminarDocumento(params: {
    docId: string;
    userSub: string;
    userPermissions: string[];
  }): Promise<void> {
    const doc = await this.repo.findDocumento(params.docId);
    if (!doc) throw new DomainError("Documento no encontrado", API_ERROR_CODES.NOT_FOUND, 404);
    const isAdmin = params.userPermissions.includes(PERMISSIONS.ADMIN_FULL) ||
      params.userPermissions.includes(PERMISSIONS.SOLICITUDES_UPLOAD);
    if (doc.userId !== params.userSub && !isAdmin) {
      throw new DomainError("Solo puedes eliminar tus propios documentos", API_ERROR_CODES.FORBIDDEN, 403);
    }
    /*
     * El cliente solo puede eliminar documentos de la iteracion actual (subidos
     * despues del ultimo cambio de revision). Las versiones de iteraciones pasadas
     * son historial y no se eliminan.
     */
    if (!isAdmin) {
      if (!doc.flgActivo || (doc.estado && doc.estado !== ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO)) {
        throw new DomainError("Este documento ya no es la version vigente", API_ERROR_CODES.CONFLICT, 409);
      }
      const detalle = await this.repo.detalle(doc.solicitudId);
      const ultimaRevision = (detalle?.revisiones ?? []).reduce<string | Date | null>(
        (ultima, r) => (!ultima || dateUtils.isAfter(r.updatedAt, ultima) ? r.updatedAt : ultima),
        null,
      );
      if (ultimaRevision && !dateUtils.isAfter(doc.createdAt, ultimaRevision)) {
        throw new DomainError(
          "Solo puedes eliminar el documento subido en la iteracion actual; las versiones anteriores son historial.",
          API_ERROR_CODES.CONFLICT,
          409,
        );
      }
    }
    await this.repo.eliminarDocumento(params.docId);
  }
}
