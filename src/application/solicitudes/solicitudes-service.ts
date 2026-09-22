import type { ISolicitudesRepository, SolicitudesListParams, SolicitudesPaginatedResult } from "@/domain/ports/solicitudes-repository";
import type { SolicitudRow, RevisionEntity } from "@/domain/models/entities";
import { REVISION_AREAS, REVISION_AREA_ORDER, RESULTADOS_APROBACION, ROLES, PERMISSIONS, API_ERROR_CODES, REVISION_AREA_NEXT_ROLE, REVISION_AREA_LABELS, SGC_TRIGGER_REVISION_AREA, TIPOS_DOCUMENTO_SOLICITUD } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
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
     * El SGC distingue contrato (documento del admin, `userId` null) de anexos
     * (documentos del cliente, `userId` no nulo). Un anexo siempre lleva `userId`
     * para que `subirAnexosDeSolicitud` lo detecte, aunque lo suba un admin.
     */
    const esAnexo = params.tipo === TIPOS_DOCUMENTO_SOLICITUD.ANEXO;
    const userId = esAnexo ? params.userSub : isAdmin ? null : params.userSub;
    return this.repo.crearDocumentoAdjunto(
      params.solicitudId, params.url, params.nombre,
      userId,
      params.userEmail,
    );
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
