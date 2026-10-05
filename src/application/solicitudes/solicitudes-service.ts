import type { ISolicitudesRepository, SolicitudesListParams, SolicitudesPaginatedResult } from "@/domain/ports/solicitudes-repository";
import type { SolicitudRow, RevisionEntity } from "@/domain/models/entities";
import { REVISION_AREAS, REVISION_AREA_ORDER, RESULTADOS_APROBACION, ROLES, PERMISSIONS, API_ERROR_CODES, REVISION_AREA_NEXT_ROLE, SGC_TRIGGER_REVISION_AREA, TIPOS_DOCUMENTO_SOLICITUD, ALERTA_TIPOS, ANEXOS_REQUERIDOS, type TipoDocumentoSolicitud } from "@/lib/shared/constants";
import { getAppUrl } from "@/lib/server/app-url";
import { DomainError } from "@/lib/server/router";
import { puedeClienteSubirDocumentos } from "@/lib/shared/utils/solicitud-documentos";
import { areasRevisionLocal } from "@/lib/shared/utils/revision-areas";
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

    const faltaRevision = areasRevisionLocal(detalle.revisiones).some(
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
    reviewerEmail: string;
  }): Promise<RevisionEntity> {
    if (!Object.values(REVISION_AREAS).includes(data.area as never)) {
      throw new Error(`Area invalida: ${data.area}`);
    }
    if (!Object.values(RESULTADOS_APROBACION).includes(data.estado as never)) {
      throw new Error(`Estado invalido: ${data.estado}`);
    }
    const revision = await this.repo.crearOActualizarRevision(data);

    // Only send alerts when transitioning FROM pendiente (first review)
    if (!revision.fuePrimeraRevision) return revision;

    if (data.area === SGC_TRIGGER_REVISION_AREA && data.estado === RESULTADOS_APROBACION.APROBADO) {
      await this.sgcIntegracion?.crearExpedienteDesdeSolicitud(data.solicitudId);
    }
    const nextRole = REVISION_AREA_NEXT_ROLE[data.area as keyof typeof REVISION_AREA_NEXT_ROLE];
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
    for (const area of REVISION_AREA_ORDER) {
      await this.repo.crearRevisionInicial(solicitudId, area);
    }
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
      if (!puedeClienteSubirDocumentos(detalle)) {
        throw new DomainError(
          "Aun no puedes adjuntar documentos. Se habilita al llegar a la revision Legal (SGC) y se cierra cuando ya se enviaron al SGC.",
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

    const doc = await this.repo.crearDocumentoAdjunto(
      params.solicitudId, params.url, params.nombre,
      userId,
      params.userEmail,
      categoria,
      requisito,
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
    if (doc.userId !== params.userSub && !params.userPermissions.includes(PERMISSIONS.ADMIN_FULL)) {
      throw new DomainError("Solo puedes eliminar tus propios documentos", API_ERROR_CODES.FORBIDDEN, 403);
    }
    await this.repo.eliminarDocumento(params.docId);
  }
}
