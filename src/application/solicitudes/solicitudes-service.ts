import type { ISolicitudesRepository, SolicitudesListParams, SolicitudesPaginatedResult } from "@/domain/ports/solicitudes-repository";
import type { SolicitudRow, RevisionEntity } from "@/domain/models/entities";
import { REVISION_AREAS, RESULTADOS_APROBACION, API_ERROR_CODES } from "@/lib/constants";
import { DomainError } from "@/lib/router";

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
    return this.repo.crearOActualizarRevision(data);
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
