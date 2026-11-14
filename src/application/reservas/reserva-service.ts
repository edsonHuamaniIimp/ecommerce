import type { IGessRepository } from "@/domain/ports/gess-repository";
import { randomUUID } from "node:crypto";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { StandEventPublisher } from "@/domain/ports/stand-events";
import type { IConfiguracionRepository } from "@/domain/ports/configuracion-repository";
import type { IEventoRepository } from "@/domain/ports/evento-repository";
import type { ContratoApplicationService } from "@/application/contratos/contrato-service";
import { ADMIN_USER_ID, API_ERROR_CODES, ESTADOS_EMPRESA, ESTADOS_SOLICITUD, ESTADOS_STAND, ESTADOS_STAND_LEGACY, IDIOMA_DEFAULT, MAX_RESERVA_ADMIN_STANDS, MODOS_PAGO, MONEDAS, PERMISSIONS, ROLES_REVISION_ASOCIADO, TIPOS_COMPROBANTE, TIPOS_DOCUMENTO_PERSONA, TIPOS_SOLICITUD } from "@/lib/shared/constants";
import { areasRevisionLocal } from "@/lib/shared/utils/revision-areas";
import { isSgcEnabled } from "@/lib/server/sgc-config";
import { esEmpresaDuenaPreReserva } from "@/lib/shared/utils/estado-stand";
import type { EmpresaViewer } from "@/lib/shared/utils/estado-stand";
import { calcularImportes } from "@/lib/shared/utils/importes";
import { convertirNeto, esMonedaContrato, tipoCambioValido, type MonedaContrato } from "@/lib/shared/utils/moneda";
import { configCuotasValida, cuotasCoincidenConfig, modalidadDeCuotas, planCuotasConFechas } from "@/lib/shared/utils/cuotas";
import { esStandComercialReservable, resolverPrecioStand } from "@/lib/shared/utils/precio-stand";
import { validarEmpresaReservaAdministrativa } from "@/lib/shared/utils/reserva-admin-readiness";
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
    private readonly eventoRepo?: IEventoRepository,
    private readonly empresaRepo?: IEmpresaRepository,
    private readonly contratoService?: Pick<ContratoApplicationService, "generar">,
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

  /** Receptores internos del aviso de nueva solicitud; usa el fallback historico si no hay config. */
  private async destinatariosNuevaSolicitud(): Promise<string[]> {
    let configurados: string[] = [];
    if (this.configuracionRepo) {
      try {
        configurados = (await this.configuracionRepo.obtenerPortal())?.notificacionesSolicitudesEmails ?? [];
      } catch {
        configurados = [];
      }
    }
    const lista = configurados.length > 0 ? configurados : [ADMIN_EMAIL];
    return [...new Set(lista.map((email) => email.trim().toLowerCase()).filter(Boolean))];
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

  /**
   * Reserva administrativa a nombre de una empresa.
   * No crea revisiones locales ni SGC: queda lista para pago.
   */
  async crearAdministrativa(input: {
    eventoId: string;
    empresaRuc: string;
    standIds: string[];
    moneda?: string;
    /** Comprobante elegido para la solicitud; si falta se usa el de la empresa. */
    tipoComprobante?: string;
    cuotas: Array<{ porcentaje: number; fechaVencimiento: string }>;
    actorEmail: string;
  }): Promise<{ ok: boolean; message: string; solicitudId?: string; estado?: string }> {
    if (!this.empresaRepo) {
      throw new DomainError("No esta configurado el repositorio de empresas", API_ERROR_CODES.INTERNAL, 500);
    }
    if (!this.solicitudesRepo) {
      throw new DomainError("No esta configurado el repositorio de solicitudes", API_ERROR_CODES.INTERNAL, 500);
    }
    if (input.standIds.length > MAX_RESERVA_ADMIN_STANDS) {
      throw new DomainError(
        `Maximo ${MAX_RESERVA_ADMIN_STANDS} stands por reserva administrativa`,
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }

    const empresa = await this.empresaRepo.findByRuc(input.empresaRuc.trim());
    if (!empresa) {
      throw new DomainError("Empresa no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    }
    if (empresa.estado !== ESTADOS_EMPRESA.ACTIVA) {
      throw new DomainError("La empresa no esta activa", API_ERROR_CODES.CONFLICT, 409);
    }

    const tipoComprobante = input.tipoComprobante ?? empresa.tipoComprobante;
    const readiness = validarEmpresaReservaAdministrativa(empresa, tipoComprobante, input.moneda ?? "");
    if (!readiness.ok) {
      throw new DomainError(
        `Faltan datos para crear el contrato y la factura: ${readiness.faltantes.join(", ")}`,
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    const contactEmail =
      empresa.representanteCorreo ??
      empresa.emailContacto ??
      empresa.emailFacturacion ??
      undefined;
    const esBoleta = tipoComprobante === TIPOS_COMPROBANTE.BOLETA;
    const representanteDni = String(empresa.representanteLegalDni ?? "").replace(/\D/g, "");
    const userSub = empresa.representanteUserId ?? undefined;

    const result = await this.crear({
      standIds: input.standIds,
      eventoId: input.eventoId,
      userSub,
      userEmail: contactEmail,
      actorEmail: input.actorEmail,
      omitirValidacionCronograma: true,
      datos: {
        razonSocial: esBoleta
          ? (empresa.representanteLegalNombre ?? empresa.razonSocial)
          : empresa.razonSocial,
        tipoDocumento: esBoleta ? TIPOS_DOCUMENTO_PERSONA.DNI : empresa.tipoDocumento,
        numeroDocumento: esBoleta ? representanteDni : empresa.ruc,
        email: contactEmail ?? "",
        tipoComprobante,
        direccion: empresa.direccionFiscal ?? undefined,
        telefono: empresa.telefono ?? undefined,
        contacto: empresa.representanteLegalNombre ?? undefined,
      },
      moneda: input.moneda,
      cuotas: input.cuotas,
      tipo: TIPOS_SOLICITUD.RESERVA_EMPRESA,
      omitirRevisiones: true,
      requerirStandComercial: true,
    });

    if (!result.ok || !result.solicitudId) return result;
    if (!this.contratoService) {
      throw new DomainError("No esta configurado el servicio de contratos", API_ERROR_CODES.INTERNAL, 500);
    }

    /*
     * La reserva administrativa no pasa por revision del Asociado: se genera el
     * contrato de inmediato y se habilita la firma. El paso a Pendiente Pago
     * ocurre recien cuando el cliente firma el contrato.
     */
    await this.contratoService.generar({
      solicitudId: result.solicitudId,
      userSub: userSub ?? "system",
      userEmail: contactEmail,
      userPermissions: [PERMISSIONS.ADMIN_FULL],
      cuotas: input.cuotas,
    });
    await this.solicitudesRepo.habilitarContrato(result.solicitudId);

    for (const standId of input.standIds) {
      await this.gessRepo.update(standId, { estado: ESTADOS_STAND.RESERVADO } as never);
    }

    return {
      ...result,
      estado: ESTADOS_SOLICITUD.PENDIENTE,
    };
  }

  async crear(request: {
    standIds: string[];
    documentos?: string[];
    /** Cronograma elegido en el wizard: snapshot para el contrato final. */
    cuotas?: Array<{ porcentaje: number; fechaVencimiento: string }>;
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
    /** Moneda elegida para el contrato (USD | PEN). Default USD. */
    moneda?: string;
    /** Tipo de solicitud con flujo propio. Null/undefined = flujo regular. */
    tipo?: string | null;
    /** Evento de la sesion: los stands deben pertenecer a el. */
    eventoId?: string;
    /** Hold creado al abrir el wizard; se convierte en reserva. */
    holdId?: string;
    /** IP del request para auditoria. */
    ip?: string | null;
    /** Reserva administrativa: no crea revisiones locales ni SGC. */
    omitirRevisiones?: boolean;
    /** Reserva administrativa: exige bloque 3D y precio comercial explícito. */
    requerirStandComercial?: boolean;
    /** Reserva administrativa: permite un cronograma propio aunque la empresa tenga uno configurado. */
    omitirValidacionCronograma?: boolean;
    /** Actor que ejecuta la operacion (admin), distinto del titular de la solicitud. */
    actorEmail?: string;
  }): Promise<{ ok: boolean; message: string; conflicted?: string[]; solicitudId?: string }> {
    const conflicted: string[] = [];
    const standCodes: string[] = [];
    const contactEmail = request.userEmail || request.datos?.email;
    const idsUnicos = [...new Set(request.standIds)];

    // Fase 1: validar todo antes de mutar (existencia, evento y estado).
    const validos: Array<{ dbId: string; standCode: string; precio: number }> = [];
    let eventoComun: string | null = request.eventoId ?? null;

    /* Empresa del solicitante: le permite reservar su propia pre-reserva (dueÃ±o). */
    const perfil = request.userEmail
      ? await this.authRepo.findPerfilByEmail(request.userEmail).catch(() => null)
      : null;
    const configCuotas = perfil?.empresa?.configCuotas ?? null;
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
      /* Pre-reserva: solo la empresa dueÃ±a (RUC/SIE/razon social) puede reservarla. */
      if (stand.estado === ESTADOS_STAND.PRE_RESERVADO && !esEmpresaDuenaPreReserva(stand, viewer)) {
        conflicted.push(`${stand.standCode} esta pre-reservado para otra empresa`);
        continue;
      }
      if (request.requerirStandComercial && !esStandComercialReservable(stand)) {
        conflicted.push(`${stand.standCode} no tiene precio comercial o bloque 3D`);
        continue;
      }
      validos.push({ dbId: stand.id, standCode: stand.standCode, precio: resolverPrecioStand(stand) });
      standCodes.push(stand.standCode);
    }

    if (conflicted.length > 0) {
      return { ok: false, message: "Conflicto", conflicted };
    }

    /* El cronograma de la empresa es la fuente de verdad. Se valida antes de
     * mutar los stands: si el cliente manipula cuotas/fechas o la configuracion
     * cambio mientras el wizard estaba abierto, no debe quedar una solicitud
     * huerfana con el stand bloqueado. */
    if (!request.omitirValidacionCronograma && configCuotasValida(configCuotas)) {
      const cuotasSolicitadas = (request.cuotas ?? []).map((cuota) => ({
        porcentaje: cuota.porcentaje,
        fechaVencimiento: cuota.fechaVencimiento,
      }));
      if (!cuotasCoincidenConfig(cuotasSolicitadas, configCuotas)) {
        return {
          ok: false,
          message: "El cronograma de pago no coincide con la configuracion vigente del IIMP. Refresca la pagina para continuar.",
          conflicted: standCodes,
        };
      }
    }

    const monedaSolicitada = request.moneda ?? MONEDAS.USD;
    if (!esMonedaContrato(monedaSolicitada)) {
      return { ok: false, message: "Moneda no valida", conflicted: standCodes };
    }
    const moneda: MonedaContrato = monedaSolicitada;
    let tipoCambio = 1;
    if (moneda === MONEDAS.PEN) {
      const evento = eventoComun && this.eventoRepo
        ? await this.eventoRepo.findById(eventoComun).catch(() => null)
        : null;
      const tcEvento = evento?.tipoCambio;
      if (!tipoCambioValido(tcEvento)) {
        return {
          ok: false,
          message: "El evento no tiene un tipo de cambio configurado para contratos en soles.",
          conflicted: standCodes,
        };
      }
      tipoCambio = tcEvento;
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
    const estadosPrevios = new Map<string, string | null>();
    for (const { dbId } of validos) {
      const stand = await this.gessRepo.findById(dbId);
      estadosPrevios.set(dbId, stand?.estado ?? null);
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
          { actor: request.actorEmail ?? request.userSub ?? null, ip: request.ip ?? null },
          { moneda, tipoCambio },
          request.tipo,
        );
        if (!request.omitirRevisiones) {
          for (const area of areasRevisionLocal([], { sgcEnabled: isSgcEnabled() })) {
            await this.solicitudesRepo.crearRevisionInicial(solicitudId, area);
          }
        }

        /* Snapshot del cronograma elegido: el contrato se genera al final. */
        if (request.cuotas && request.cuotas.length > 0) {
          const netoUsd = validos.reduce((total, stand) => total + stand.precio, 0);
          const neto = convertirNeto(netoUsd, moneda, tipoCambio);
          const importes = calcularImportes(neto);
          const porcentajes = request.cuotas.map((cuota) => cuota.porcentaje);
          const fechas = request.cuotas.map((cuota) => cuota.fechaVencimiento);
          await this.solicitudesRepo.guardarPlanCuotas(solicitudId, {
            modalidad: request.omitirValidacionCronograma || configCuotasValida(configCuotas)
              ? MODOS_PAGO.PERSONALIZADO
              : modalidadDeCuotas(porcentajes),
            cuotas: planCuotasConFechas(importes.total, porcentajes, fechas),
            moneda,
            tipoCambio,
          });
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
        // No ocultar el fallo: si no se crea la solicitud, los stands no deben
        // quedar bloqueados en un estado sin expediente.
        console.error("[reserva] Error al crear solicitud/revisiones iniciales:", err);
        if (!solicitudId) {
          for (const dbId of createdStandIds) {
            await this.gessRepo.update(dbId, {
              estado: estadosPrevios.get(dbId) ?? ESTADOS_STAND.DISPONIBLE,
            } as never).catch(() => {});
          }
        }
        throw new DomainError(
          "No se pudo crear la solicitud. Intenta nuevamente o revisa el registro del servidor.",
          API_ERROR_CODES.INTERNAL,
          500,
        );
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
      const destinatarios = await this.destinatariosNuevaSolicitud();
      const correoCliente = contactEmail.trim().toLowerCase();
      for (const destinatario of destinatarios) {
        if (destinatario === correoCliente) continue;
        enviarEmailPlantilla({
          to: destinatario,
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
