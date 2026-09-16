import type { ISolicitudesRepository, SolicitudesListParams, SolicitudesPaginatedResult } from "@/domain/ports/solicitudes-repository";
import type { SolicitudRow, RevisionEntity } from "@/domain/models/entities";
import { REVISION_AREAS, RESULTADOS_APROBACION, API_ERROR_CODES, REVISION_AREA_ORDER, REVISION_AREA_NEXT_ROLE, REVISION_AREA_LABELS } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";

export class SolicitudesApplicationService {
  readonly repo: ISolicitudesRepository;

  constructor(repo: ISolicitudesRepository) {
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
          rol: "admin",
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
    const areas = Object.values(REVISION_AREAS);
    for (const area of areas) {
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
  }): Promise<Record<string, unknown>> {
    const isAdmin = params.userPermissions.includes("admin:full") || params.userPermissions.includes("solicitudes:upload");
    return this.repo.crearDocumentoAdjunto(
      params.solicitudId, params.url, params.nombre,
      isAdmin ? null : params.userSub,
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
    if (doc.userId !== params.userSub && !params.userPermissions.includes("admin:full")) {
      throw new DomainError("Solo puedes eliminar tus propios documentos", API_ERROR_CODES.FORBIDDEN, 403);
    }
    await this.repo.eliminarDocumento(params.docId);
  }
}
