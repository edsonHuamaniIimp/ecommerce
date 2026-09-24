import type { ISolicitudesRepository, SolicitudesListParams, SolicitudesPaginatedResult } from "@/domain/ports/solicitudes-repository";
import type { SolicitudRow, RevisionEntity } from "@/domain/models/entities";
import { REVISION_AREAS, REVISION_AREA_ORDER, RESULTADOS_APROBACION, ROLES, PERMISSIONS, API_ERROR_CODES, REVISION_AREA_NEXT_ROLE, REVISION_AREA_LABELS, SGC_TRIGGER_REVISION_AREA, TIPOS_DOCUMENTO_SOLICITUD, ALERTA_TIPOS, APP_URL, type TipoDocumentoSolicitud } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import { puedeClienteSubirDocumentos } from "@/lib/shared/utils/solicitud-documentos";
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

    const areaLabel = REVISION_AREA_LABELS[data.area as keyof typeof REVISION_AREA_LABELS];
    const nextRole = REVISION_AREA_NEXT_ROLE[data.area as keyof typeof REVISION_AREA_NEXT_ROLE];
    if (nextRole) {
      const detalle = await this.repo.detalle(data.solicitudId);
      if (detalle) {
        const nextLabel = REVISION_AREA_LABELS[nextRole as keyof typeof REVISION_AREA_LABELS] ?? nextRole;
        await this.repo.crearAlertaRevision({
          rol: nextRole,
          solicitudId: data.solicitudId,
          titulo: `Turno de revision — ${nextLabel}`,
          mensaje: `El area de ${areaLabel} ya completo su revision de los stands ${detalle.standCode}. Ahora es tu turno de revisar.`,
          standCodes: detalle.standCode,
        }).catch(() => {});
      }
    } else {
      const detalle = await this.repo.detalle(data.solicitudId);
      if (detalle) {
        await this.repo.crearAlertaRevision({
          rol: ROLES.ADMIN,
          solicitudId: data.solicitudId,
          titulo: "Revision completada — todas las areas",
          mensaje: `Todas las areas han finalizado la revision de los stands ${detalle.standCode}.`,
          standCodes: detalle.standCode,
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
            titulo: "Contrato firmado subido",
            mensaje: `El cliente subio el contrato firmado de la solicitud ${detalle.standCode}. Revisa los documentos para continuar con el flujo.`,
            url: `${APP_URL}/dashboard/solicitudes?id=${params.solicitudId}`,
          });
        }
      } catch { /* best-effort */ }
    }

    return doc;
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
