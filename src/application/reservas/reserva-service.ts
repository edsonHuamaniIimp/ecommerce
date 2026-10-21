import type { IGessRepository } from "@/domain/ports/gess-repository";
import { randomUUID } from "node:crypto";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { StandEventPublisher } from "@/domain/ports/stand-events";
import type { IConfiguracionRepository } from "@/domain/ports/configuracion-repository";
import { ESTADOS_STAND, ESTADOS_STAND_LEGACY, IDIOMA_DEFAULT, REVISION_AREA_ORDER, ROLES_REVISION_ASOCIADO, ADMIN_USER_ID } from "@/lib/shared/constants";
import { esEmpresaDuenaPreReserva } from "@/lib/shared/utils/estado-stand";
import type { EmpresaViewer } from "@/lib/shared/utils/estado-stand";
import { getAppUrl } from "@/lib/server/app-url";
import { enviarEmailPlantilla } from "@/lib/server/email";
import { resolverIdiomaDestinatario } from "@/application/idioma/resolver-idioma";
import { ALERTA_CLAVES } from "@/lib/shared/alert-templates";
import { DomainError } from "@/lib/server/router";

const BLOQUEADOS: string[] = [ESTADOS_STAND.EN_EVALUACION, ESTADOS_STAND.RESERVADO, ESTADOS_STAND_LEGACY.RESERVADO, ESTADOS_STAND_LEGACY.EN_EVALUACION];
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "ext_analistaprogramador3@iimp.org.pe";

export class ReservaApplicationService {
  constructor(
    private readonly gessRepo: IGessRepository,
    private readonly solicitudesRepo: ISolicitudesRepository | undefined,
    private readonly authRepo: IAuthRepository,
    private readonly standEvents?: StandEventPublisher,
    private readonly configuracionRepo?: IConfiguracionRepository,
  ) {}

  /** Duracion configurada del hold; 25 minutos si no hay configuracion. */
  private async minutosHold(): Promise<number> {
    if (!this.configuracionRepo) return 25;
    try {
      return (await this.configuracionRepo.obtenerPortal())?.holdReservaMinutos ?? 25;
    } catch {
      return 25;
    }
  }

  /** Bloquea temporalmente los stands al abrir el wizard (todo o nada). */
  async crearHold(
    standIds: string[],
    eventoId: string,
    userSub: string,
    userEmail: string | undefined,
    minutos?: number,
  ): Promise<{ holdId: string; expiresAt: string; reservaEnMinutos: number }> {
    if (!userSub) throw new DomainError("Inicia sesion para reservar", "UNAUTHORIZED", 401);
    if (!eventoId) throw new DomainError("Evento requerido para bloquear stands", "VALIDATION", 400);
    const ids = [...new Set(standIds.filter(Boolean))];
    /* La empresa duena de una pre-reserva puede bloquear y reservar su propio stand. */
    const perfil = userEmail
      ? await this.authRepo.findPerfilByEmail(userEmail).catch(() => null)
      : null;
    const viewer: EmpresaViewer = {
      ruc: perfil?.empresa?.ruc ?? null,
      razonSocial: perfil?.empresa?.razonSocial ?? perfil?.nombreEmpresa ?? null,
    };
    const detalle = await Promise.all(ids.map((id) => this.gessRepo.findById(id)));
    const preReservadosPropios = detalle
      .filter((stand): stand is NonNullable<typeof stand> =>
        Boolean(stand && stand.eventoId === eventoId && stand.estado === ESTADOS_STAND.PRE_RESERVADO && esEmpresaDuenaPreReserva(stand, viewer)),
      )
      .map((stand) => stand.id);
    const duracion = minutos ?? await this.minutosHold();
    const holdId = randomUUID();
    const expiresAt = new Date(Date.now() + duracion * 60 * 1000);
    const resultado = await this.gessRepo.crearHold({
      standIds: ids,
      eventoId,
      holdId,
      userId: userSub,
      expiresAt,
      preReservadosPropios,
    });
    if (!resultado.ok) {
      throw new DomainError(
        `Los stands ya estan en proceso o reservados: ${resultado.conflictos.join(", ")}`,
        "CONFLICT",
        409,
      );
    }
    if (this.standEvents) {
      const detalle = await Promise.all([...new Set(standIds)].map((id) => this.gessRepo.findById(id)));
      const stands = detalle.filter((s): s is NonNullable<typeof s> => s !== null);
      await this.standEvents.standHold({
        eventoId,
        holdId,
        standIds: stands.map((s) => s.id),
        standCodes: stands.map((s) => s.standCode),
        expiresAt: expiresAt.toISOString(),
      }).catch(() => {});
    }
    return { holdId, expiresAt: expiresAt.toISOString(), reservaEnMinutos: duracion };
  }

  /** Libera un hold propio (al cerrar el wizard). */
  async liberarHold(holdId: string, userSub: string): Promise<number> {
    const stands = await this.gessRepo.liberarHold(holdId, userSub);
    if (stands.length > 0 && this.standEvents) {
      const eventoId = stands[0]?.eventoId;
      if (eventoId) {
        await this.standEvents.standReleased({
          eventoId,
          holdId,
          standIds: stands.map((s) => s.id),
          standCodes: stands.map((s) => s.standCode),
        }).catch(() => {});
      }
    }
    return stands.length;
  }

  async crear(request: {
    standIds: string[];
    documentos?: string[];
    datos?: {
      razonSocial: string;
      tipoDocumento: string;
      numeroDocumento: string;
      email: string;
      tipoComprobante?: string;
      direccion?: string;
      telefono?: string;
      contacto?: string;
    };
    userEmail?: string;
    userSub?: string;
    /** Evento de la sesion: los stands deben pertenecer a el. */
    eventoId?: string;
    /** Hold creado al abrir el wizard; se convierte en reserva. */
    holdId?: string;
    /** IP del request para auditoria. */
    ip?: string | null;
  }): Promise<{ ok: boolean; message: string; conflicted?: string[]; solicitudId?: string }> {
    const conflicted: string[] = [];
    const standCodes: string[] = [];
    const contactEmail = request.userEmail || request.datos?.email;
    const idsUnicos = [...new Set(request.standIds)];

    // Fase 1: validar todo antes de mutar (existencia, evento y estado).
    const validos: Array<{ dbId: string; standCode: string }> = [];
    let eventoComun: string | null = request.eventoId ?? null;

    /* Empresa del solicitante: le permite reservar su propia pre-reserva (dueño). */
    const perfil = request.userEmail
      ? await this.authRepo.findPerfilByEmail(request.userEmail).catch(() => null)
      : null;
    const ahora = new Date();
    const viewer: EmpresaViewer = {
      ruc: perfil?.empresa?.ruc ?? null,
      razonSocial: perfil?.empresa?.razonSocial ?? perfil?.nombreEmpresa ?? null,
    };

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
      if (stand.holdExpiresAt && stand.holdExpiresAt > ahora && stand.holdUserId !== request.userSub) {
        conflicted.push(`${stand.standCode} esta en proceso por otra empresa`);
        continue;
      }
      if (stand.estado && BLOQUEADOS.includes(stand.estado)) {
        const label = stand.estado === ESTADOS_STAND.RESERVADO || stand.estado === ESTADOS_STAND_LEGACY.RESERVADO ? "Reservado" : "En evaluacion";
        conflicted.push(`${stand.standCode} ya esta en estado ${label}`);
        continue;
      }
      /* Pre-reserva: solo la empresa dueña (RUC/SIE/razon social) puede reservarla. */
      if (stand.estado === ESTADOS_STAND.PRE_RESERVADO && !esEmpresaDuenaPreReserva(stand, viewer)) {
        conflicted.push(`${stand.standCode} esta pre-reservado para otra empresa`);
        continue;
      }
      validos.push({ dbId: stand.id, standCode: stand.standCode });
      standCodes.push(stand.standCode);
    }

    if (conflicted.length > 0) {
      return { ok: false, message: "Conflicto", conflicted };
    }

    // Fase 2: aplicar los cambios solo si todo paso la validacion.
    if (request.holdId) {
      const holdValido = request.userSub
        ? await this.gessRepo.validarHold(idsUnicos, request.holdId, request.userSub)
        : false;
      if (!holdValido) {
        return { ok: false, message: "El bloqueo temporal expiro. Vuelve a seleccionar los stands.", conflicted: standCodes };
      }
    }
    const createdStandIds: string[] = [];
    for (const { dbId } of validos) {
      await this.gessRepo.update(dbId, {
        estado: ESTADOS_STAND.EN_EVALUACION,
        email: contactEmail ?? null,
        userId: request.userSub ?? null,
        documentos: request.documentos,
        holdId: null,
        holdUserId: null,
        holdExpiresAt: null,
      } as never);
      createdStandIds.push(dbId);
    }

    if (eventoComun && this.standEvents) {
      await this.standEvents.standReservado({
        eventoId: eventoComun,
        standIds: createdStandIds,
        standCodes,
      }).catch(() => {});
    }

    let solicitudId: string | undefined;
    if (this.solicitudesRepo) {
      try {
        /* Snapshot fiscal del paso 1: fuente del payload de reserva del IIMP. */
        const snapshot = request.datos
          ? {
              tipoComprobante: request.datos.tipoComprobante ?? null,
              tipoDocumento: request.datos.tipoDocumento,
              numeroDocumento: request.datos.numeroDocumento,
              razonSocial: request.datos.razonSocial,
              direccion: request.datos.direccion ?? null,
              telefono: request.datos.telefono ?? null,
              contacto: request.datos.contacto ?? null,
              email: request.datos.email,
            }
          : null;
        solicitudId = await this.solicitudesRepo.crearSolicitud(
          createdStandIds,
          request.userSub,
          contactEmail ?? undefined,
          snapshot,
          { actor: request.userSub ?? null, ip: request.ip ?? null },
        );
        for (const area of REVISION_AREA_ORDER) {
          await this.solicitudesRepo.crearRevisionInicial(solicitudId, area);
        }

        // Alerta a los revisores del nivel local "Asociado" (unifica Logistica + Comunicacion).
        for (const rol of ROLES_REVISION_ASOCIADO) {
          this.solicitudesRepo.crearAlertaRevision({
            rol,
            solicitudId,
            clave: ALERTA_CLAVES.NUEVA_SOLICITUD_REVISION,
            datos: { stands: standCodes.join(", ") },
          }).catch(() => {});
        }

        const esMultiple = createdStandIds.length > 1;
        if (esMultiple && request.userSub) {
          try {
            await this.solicitudesRepo.crearAlertaReserva({
              userId: request.userSub,
              tipo: "reserva_multiple",
              clave: ALERTA_CLAVES.SOLICITUD_MULTIPLE_CLIENTE,
              datos: { total: createdStandIds.length, stands: standCodes.join(", ") },
              url: `${getAppUrl()}/dashboard/mis-solicitudes?id=${solicitudId}`,
            });
            await this.solicitudesRepo.crearAlertaReserva({
              userId: ADMIN_USER_ID,
              tipo: "reserva_multiple",
              clave: ALERTA_CLAVES.SOLICITUD_MULTIPLE_ADMIN,
              datos: { total: createdStandIds.length, stands: standCodes.join(", ") },
              url: `${getAppUrl()}/dashboard/solicitudes?id=${solicitudId}`,
            });
          } catch { /* ok */ }
        }
      } catch (err) {
        // No ocultar el fallo: si la solicitud/revisiones no se crean, el flujo de
        // revision no arranca aunque el stand ya quedo en_evaluacion.
        console.error("[reserva] Error al crear solicitud/revisiones iniciales:", err);
      }
    }

    if (contactEmail) {
      const idiomaCliente = await resolverIdiomaDestinatario(this.authRepo, contactEmail);
      enviarEmailPlantilla({
        to: contactEmail,
        plantilla: "reserva-confirmacion",
        idioma: idiomaCliente,
        datos: {
          standCodes: standCodes.join(", "),
          razonSocial: request.datos?.razonSocial || "-",
          documento: `${request.datos?.tipoDocumento || ""} ${request.datos?.numeroDocumento || ""}`.trim() || "-",
          esMultiple: createdStandIds.length > 1,
          solicitudId,
        },
      }).catch(() => {});
      if (ADMIN_EMAIL && ADMIN_EMAIL !== contactEmail) {
        enviarEmailPlantilla({
          to: ADMIN_EMAIL,
          plantilla: "reserva-admin",
          idioma: IDIOMA_DEFAULT,
          datos: {
            standCodes: standCodes.join(", "),
            razonSocial: request.datos?.razonSocial || "-",
            documento: `${request.datos?.tipoDocumento || ""} ${request.datos?.numeroDocumento || ""}`.trim() || "-",
            emailCliente: contactEmail,
            solicitudId,
          },
        }).catch(() => {});
      }
    }

    return { ok: true, message: `${standCodes.length} stand(s) reservados`, solicitudId };
  }
}
