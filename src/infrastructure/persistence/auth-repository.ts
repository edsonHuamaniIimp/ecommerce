import { prisma } from "@/lib/server/db";
import { esHash, hashPassword } from "@/lib/server/utils/password";
import { dateUtils } from "@/lib/shared/utils/date";
import type { ConfigCuotasEmpresa } from "@/lib/shared/utils/cuotas";

/** Blindaje: cualquier contrasena que llegue en texto plano se hashea antes de persistir. */
function hashearSiHaceFalta(password: string): string {
  return esHash(password) ? password : hashPassword(password);
}
import type {
  IAuthRepository,
  NuevoUsuarioAuth,
  RegistroPendienteData,
} from "@/domain/ports/auth-repository";

export class AuthPrismaRepository implements IAuthRepository {
  async findByEmail(email: string) {
    return prisma.userRole.findMany({
      where: { email },
      select: { id: true, userId: true, roleId: true, email: true, password: true, eventoId: true, eventoNombre: true, eventoPadreNombre: true, empresaId: true, debeCambiarPassword: true, flgActivo: true, reactivarEn: true, role: { select: { nombre: true, permisos: true } } },
    });
  }

  async findByRuc(ruc: string) {
    return prisma.userRole.findMany({
      where: { ruc },
      select: { id: true, userId: true, roleId: true, email: true, password: true, eventoId: true, eventoNombre: true, eventoPadreNombre: true, empresaId: true, debeCambiarPassword: true, flgActivo: true, reactivarEn: true, role: { select: { nombre: true, permisos: true } } },
    });
  }

  async setEventoSeleccionado(email: string, eventoId: string, eventoNombre?: string | null, eventoPadreNombre?: string | null): Promise<void> {
    await prisma.userRole.updateMany({
      where: { email },
      data: {
        eventoId,
        ...(eventoNombre !== undefined ? { eventoNombre } : {}),
        ...(eventoPadreNombre !== undefined ? { eventoPadreNombre } : {}),
      },
    });
  }

  async existeEmail(email: string): Promise<boolean> {
    const total = await prisma.userRole.count({ where: { email } });
    return total > 0;
  }

  async crearUsuario(data: NuevoUsuarioAuth): Promise<void> {
    await prisma.userRole.create({
      data: {
        userId: data.userId,
        roleId: data.roleId,
        email: data.email,
        /* Blindaje: nunca se guarda texto plano aunque el caller lo olvide. */
        password: hashearSiHaceFalta(data.password),
        nombre: data.nombre,
        apellidos: data.apellidos,
        telefono: data.telefono,
      nombreEmpresa: data.nombreEmpresa,
      empresaId: data.empresaId ?? null,
        idEmpresa: data.idEmpresa ?? null,
        sieCode: data.sieCode ?? null,
        ruc: data.ruc ?? null,
        debeCambiarPassword: data.debeCambiarPassword ?? false,
      ...(data.idioma ? { idioma: data.idioma } : {}),
      },
    });
  }

  async upsertRegistroPendiente(data: RegistroPendienteData): Promise<void> {
    const registro = {
      codigo: data.codigo,
      password: hashearSiHaceFalta(data.password),
      nombre: data.nombre,
      apellidos: data.apellidos,
      razonSocial: data.razonSocial,
      telefono: data.telefono,
      ruc: data.ruc,
      intentos: 0,
      expiraEn: data.expiraEn,
    };
    await prisma.registroPendiente.upsert({
      where: { email: data.email },
      create: { email: data.email, ...registro },
      update: registro,
    });
  }

  async findRegistroPendiente(email: string) {
    return prisma.registroPendiente.findUnique({ where: { email } });
  }

  async actualizarIntentosRegistro(id: string, intentos: number): Promise<void> {
    await prisma.registroPendiente.update({ where: { id }, data: { intentos } });
  }

  async eliminarRegistroPendiente(id: string): Promise<void> {
    await prisma.registroPendiente.delete({ where: { id } });
  }

  async findEventoById(id: string) {
    const ev = await prisma.evento.findUnique({
      where: { id },
      include: { eventoPadre: { select: { nombre: true } } },
    });
    if (!ev) return null;
    return {
      id: ev.id,
      eventoPadreId: ev.eventoPadreId,
      anio: ev.anio,
      eventoPadre: { nombre: ev.eventoPadre.nombre },
      tipoEvento: ev.tipoEvento,
      codigoEvento: ev.codigoEvento,
    };
  }

  async findOrCreateEvento(tipoEvento: number, codigoEvento: number) {
    const ev = await prisma.evento.upsert({
      where: { tipoEvento_codigoEvento: { tipoEvento, codigoEvento } },
      update: {},
      create: {
        tipoEvento, codigoEvento,
        anio: String(dateUtils.currentYear()),
        eventoPadreId: await this.ensureEventoPadre(tipoEvento),
      },
      select: { id: true },
    });
    return ev;
  }

  private async ensureEventoPadre(tipoEvento: number) {
    const exist = await prisma.eventoPadre.findFirst({ where: { codigo: String(tipoEvento) }, select: { id: true } });
    if (exist) return exist.id;
    const created = await prisma.eventoPadre.create({ data: { codigo: String(tipoEvento), vertical: "api", nombre: `Evento ${tipoEvento}` }, select: { id: true } });
    return created.id;
  }

  async findPerfilByEmail(email: string) {
    const row = await prisma.userRole.findFirst({
      where: { email },
      select: {
        userId: true, email: true, nombre: true, apellidos: true, telefono: true, tipoUsuarioId: true,
        idEmpresa: true, nombreEmpresa: true, logoUrl: true, firmaUrl: true, idioma: true,
        notificationEmail: true, notificationEmailVerifiedAt: true, notificationEmailPending: true,
        empresa: { select: { ruc: true, razonSocial: true, nombreComercial: true, direccionFiscal: true, telefono: true, emailContacto: true, emailFacturacion: true, tipoComprobante: true, sitioWeb: true, representanteLegalNombre: true, representanteLegalDni: true, representanteCorreo: true, representanteCelular: true, representanteDireccion: true, partidaElectronica: true, configCuotas: true } },
      },
    });
    if (!row) return null;
    return {
      ...row,
      idioma: row.idioma ?? null,
      empresa: row.empresa
        ? { ...row.empresa, configCuotas: (row.empresa.configCuotas as ConfigCuotasEmpresa | null) ?? null }
        : null,
    };
  }

  /** Empresa del Portal (PK) vinculada a la cuenta (para el contrato). */
  async findEmpresaIdDeUsuario(email: string): Promise<string | null> {
    const u = await prisma.userRole.findFirst({ where: { email }, select: { empresaId: true } });
    return u?.empresaId ?? null;
  }

  async findSieCodePorEmail(email: string): Promise<string | null> {
    const u = await prisma.userRole.findFirst({ where: { email }, select: { sieCode: true } });
    return u?.sieCode ?? null;
  }

  async existeCuentaConRuc(ruc: string): Promise<boolean> {
    const u = await prisma.userRole.findFirst({ where: { ruc }, select: { email: true } });
    return Boolean(u);
  }

  /**
   * Renombra el evento local con el nombre visible de KB: el padre se crea como
   * "Evento N" (placeholder) y el dashboard lo mostraba asi en vez de "PERUMIN".
   */
  async renombrarEvento(eventoId: string, padreNombre: string | null, anio: string | null): Promise<void> {
    if (!padreNombre && !anio) return;
    const ev = await prisma.evento.findUnique({ where: { id: eventoId }, select: { eventoPadreId: true } });
    if (!ev) return;
    if (padreNombre) {
      await prisma.eventoPadre.update({ where: { id: ev.eventoPadreId }, data: { nombre: padreNombre } });
    }
    if (anio) {
      await prisma.evento.update({ where: { id: eventoId }, data: { anio } });
    }
  }

  async updatePerfil(email: string, data: { nombre?: string; apellidos?: string; telefono?: string; tipoUsuarioId?: number | null; idEmpresa?: string | null; nombreEmpresa?: string | null; empresaId?: string | null; logoUrl?: string | null; firmaUrl?: string | null }) {
    await prisma.userRole.updateMany({ where: { email }, data });
  }

  async findNotificationConfig(userId: string) {
    return prisma.userRole.findFirst({
      where: { userId },
      select: {
        email: true,
        notificationEmail: true,
        notificationEmailVerifiedAt: true,
        notificationEmailPending: true,
        notificationEmailCode: true,
        notificationEmailCodeExpires: true,
      },
    });
  }

  async guardarNotificacionPendiente(
    userId: string,
    pending: string,
    code: string,
    expires: Date,
  ): Promise<void> {
    await prisma.userRole.updateMany({
      where: { userId },
      data: {
        notificationEmailPending: pending,
        notificationEmailCode: code,
        notificationEmailCodeExpires: expires,
      },
    });
  }

  async activarNotificacionEmail(userId: string, email: string): Promise<void> {
    await prisma.userRole.updateMany({
      where: { userId },
      data: {
        notificationEmail: email,
        notificationEmailVerifiedAt: new Date(),
        notificationEmailPending: null,
        notificationEmailCode: null,
        notificationEmailCodeExpires: null,
      },
    });
  }

  async usarCorreoAccesoParaNotificaciones(userId: string): Promise<void> {
    await prisma.userRole.updateMany({
      where: { userId },
      data: {
        notificationEmail: null,
        notificationEmailVerifiedAt: new Date(),
        notificationEmailPending: null,
        notificationEmailCode: null,
        notificationEmailCodeExpires: null,
      },
    });
  }

  async findForReset(email: string) {
    return prisma.userRole.findFirst({
      where: { email },
      select: { id: true, email: true, nombre: true, flgActivo: true },
    });
  }

  async setResetToken(id: string, token: string, expires: Date) {
    await prisma.userRole.update({ where: { id }, data: { resetToken: token, resetTokenExpires: expires } });
  }

  async findByResetToken(token: string) {
    return prisma.userRole.findFirst({
      where: { resetToken: token, resetTokenExpires: { gte: dateUtils.now() } },
      select: { id: true },
    });
  }

  async updatePassword(id: string, password: string) {
    await prisma.userRole.update({ where: { id }, data: { password: hashearSiHaceFalta(password), resetToken: null, resetTokenExpires: null } });
  }

  /**
   * Cambia el correo de contacto de la cuenta completa.
   * El userId es un UUID inmutable: no se modifica.
   */
  async actualizarEmailCuenta(userId: string, email: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const cuenta = await tx.userRole.findFirst({
        where: { userId },
        select: { email: true },
      });
      const emailAnterior = cuenta?.email ?? null;

      await tx.userRole.updateMany({
        where: { userId },
        data: { email },
      });

      if (!emailAnterior) return;

      /* El correo visible de la solicitud se actualiza; el userId no cambia. */
      await tx.solicitud.updateMany({
        where: { userId },
        data: { email },
      });

      const solicitudes = await tx.solicitud.findMany({
        where: { userId },
        select: { id: true },
      });
      const solicitudIds = solicitudes.map((s) => s.id);

      /* Auditoria visible (uploadedBy): solo documentos de estas solicitudes. */
      if (solicitudIds.length > 0) {
        await tx.solicitudDocumento.updateMany({
          where: { solicitudId: { in: solicitudIds }, uploadedBy: emailAnterior },
          data: { uploadedBy: email },
        });
      }
    });
  }

  /** Setea el sie_code (persona en servicio-persona) a las cuentas de la empresa que aun no lo tienen. */
  async actualizarSieCodeDeEmpresa(empresaId: string, sieCode: string): Promise<void> {
    await prisma.userRole.updateMany({
      where: { empresaId, sieCode: null },
      data: { sieCode },
    });
  }

  /** Refleja los datos del representante (usuario del sistema) en las cuentas de la empresa. */
  async actualizarDatosUsuarioDeEmpresa(empresaId: string, data: { nombre?: string | null; telefono?: string | null }): Promise<void> {
    await prisma.userRole.updateMany({ where: { empresaId }, data });
  }

  async marcarCambioPasswordRequerido(email: string, requerido: boolean): Promise<void> {
    await prisma.userRole.updateMany({ where: { email }, data: { debeCambiarPassword: requerido } });
  }

  /** Reactiva las cuentas cuya reactivacion programada ya vencio (desactivacion masiva). */
  async reactivarCuentasProgramadas(): Promise<number> {
    const resultado = await prisma.userRole.updateMany({
      where: { flgActivo: false, reactivarEn: { lte: dateUtils.now() } },
      data: { flgActivo: true, reactivarEn: null },
    });
    return resultado.count;
  }

  async estadoEmpresaPortal(email: string): Promise<{ empresaId: string; primerAccesoCompletado: boolean } | null> {
    const row = await prisma.userRole.findFirst({
      where: { email, empresaId: { not: null } },
      select: { empresaId: true, empresa: { select: { primerAccesoCompletado: true } } },
    });
    if (!row?.empresaId) return null;
    return { empresaId: row.empresaId, primerAccesoCompletado: row.empresa?.primerAccesoCompletado ?? false };
  }

  async setIdioma(email: string, idioma: string): Promise<void> {
    await prisma.userRole.updateMany({ where: { email }, data: { idioma } });
  }
}
