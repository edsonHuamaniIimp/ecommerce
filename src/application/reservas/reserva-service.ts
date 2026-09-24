import type { IGessRepository } from "@/domain/ports/gess-repository";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import { ESTADOS_STAND, ESTADOS_STAND_LEGACY, REVISION_AREA_ORDER, ROLES, ADMIN_USER_ID, APP_URL } from "@/lib/shared/constants";
import { sendEmail, buildReservaConfirmationEmail, buildAdminNotificacionEmail } from "@/lib/server/email";

const BLOQUEADOS: string[] = [ESTADOS_STAND.EN_EVALUACION, ESTADOS_STAND.RESERVADO, ESTADOS_STAND_LEGACY.RESERVADO, ESTADOS_STAND_LEGACY.EN_EVALUACION];
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "ext_analistaprogramador3@iimp.org.pe";

export class ReservaApplicationService {
  constructor(
    private readonly gessRepo: IGessRepository,
    private readonly solicitudesRepo?: ISolicitudesRepository,
  ) {}

  async crear(request: {
    standIds: string[];
    documentos?: string[];
    datos?: { razonSocial: string; tipoDocumento: string; numeroDocumento: string; email: string };
    userEmail?: string;
    userSub?: string;
    /** Evento de la sesion: los stands deben pertenecer a el. */
    eventoId?: string;
  }): Promise<{ ok: boolean; message: string; conflicted?: string[] }> {
    const conflicted: string[] = [];
    const standCodes: string[] = [];
    const contactEmail = request.userEmail || request.datos?.email;
    const idsUnicos = [...new Set(request.standIds)];

    // Fase 1: validar todo antes de mutar (existencia, evento y estado).
    const validos: Array<{ dbId: string; standCode: string }> = [];
    let eventoComun: string | null = request.eventoId ?? null;

    for (const dbId of idsUnicos) {
      const stand = await this.gessRepo.findById(dbId);
      if (!stand) {
        conflicted.push("Stand no encontrado");
        continue;
      }
      if (!stand.eventoId) {
        conflicted.push(`${stand.standCode} no tiene evento asignado`);
        continue;
      }
      if (eventoComun === null) eventoComun = stand.eventoId;
      if (stand.eventoId !== eventoComun) {
        conflicted.push(`${stand.standCode} no pertenece al evento actual`);
        continue;
      }
      if (stand.estado && BLOQUEADOS.includes(stand.estado)) {
        const label = stand.estado === ESTADOS_STAND.RESERVADO || stand.estado === ESTADOS_STAND_LEGACY.RESERVADO ? "Reservado" : "En evaluacion";
        conflicted.push(`${stand.standCode} ya esta en estado ${label}`);
        continue;
      }
      validos.push({ dbId: stand.id, standCode: stand.standCode });
      standCodes.push(stand.standCode);
    }

    if (conflicted.length > 0) {
      return { ok: false, message: "Conflicto", conflicted };
    }

    // Fase 2: aplicar los cambios solo si todo paso la validacion.
    const createdStandIds: string[] = [];
    for (const { dbId } of validos) {
      await this.gessRepo.update(dbId, {
        estado: ESTADOS_STAND.EN_EVALUACION,
        email: contactEmail ?? null,
        userId: request.userSub ?? null,
        documentos: request.documentos,
      } as never);
      createdStandIds.push(dbId);
    }

    let solicitudId: string | undefined;
    if (this.solicitudesRepo) {
      try {
        solicitudId = await this.solicitudesRepo.crearSolicitud(
          createdStandIds,
          request.userSub,
          contactEmail ?? undefined,
        );
        for (const area of REVISION_AREA_ORDER) {
          await this.solicitudesRepo.crearRevisionInicial(solicitudId, area);
        }

        // Notify first reviewers (logistica)
        this.solicitudesRepo.crearAlertaRevision({
          rol: ROLES.LOGISTICA,
          solicitudId,
          titulo: "Nueva solicitud para revision",
          mensaje: `Se ha creado una nueva solicitud de los stands ${standCodes.join(", ")}. Eres el primer revisor.`,
          standCodes: standCodes.join(", "),
        }).catch(() => {});

        const esMultiple = createdStandIds.length > 1;
        if (esMultiple && request.userSub) {
          try {
            await this.solicitudesRepo.crearAlertaReserva({
              userId: request.userSub,
              tipo: "reserva_multiple",
              titulo: "Solicitud multiple enviada",
              mensaje: `Se ha creado una solicitud multiple con ${createdStandIds.length} stands (${standCodes.join(", ")}). Adjunta los documentos requeridos para continuar.`,
              url: `${APP_URL}/dashboard/mis-solicitudes?id=${solicitudId}`,
            });
            await this.solicitudesRepo.crearAlertaReserva({
              userId: ADMIN_USER_ID,
              tipo: "reserva_multiple",
              titulo: "Nueva solicitud multiple",
              mensaje: `Se ha recibido una solicitud multiple de ${createdStandIds.length} stands (${standCodes.join(", ")}).`,
              url: `${APP_URL}/dashboard/solicitudes?id=${solicitudId}`,
            });
          } catch { /* ok */ }
        }
      } catch { /* ok */ }
    }

    if (contactEmail) {
      const emailData = {
        standCodes: standCodes.join(", "),
        razonSocial: request.datos?.razonSocial || "—",
        documento: `${request.datos?.tipoDocumento || ""} ${request.datos?.numeroDocumento || ""}`.trim() || "—",
        emailCliente: contactEmail,
      };
      const clientEmail = buildReservaConfirmationEmail({
        ...emailData,
        email: contactEmail,
        esMultiple: createdStandIds.length > 1,
        solicitudId,
      });
      sendEmail({ to: contactEmail, ...clientEmail }).catch(() => {});
      if (ADMIN_EMAIL && ADMIN_EMAIL !== contactEmail) {
        const adminEmail = buildAdminNotificacionEmail(emailData);
        sendEmail({ to: ADMIN_EMAIL, ...adminEmail }).catch(() => {});
      }
    }

    return { ok: true, message: `${standCodes.length} stand(s) reservados` };
  }
}
