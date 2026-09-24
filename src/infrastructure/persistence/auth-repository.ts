import { prisma } from "@/lib/server/db";
import type {
  IAuthRepository,
  NuevoUsuarioAuth,
  RegistroPendienteData,
} from "@/domain/ports/auth-repository";

export class AuthPrismaRepository implements IAuthRepository {
  async findByEmail(email: string) {
    return prisma.userRole.findMany({
      where: { email },
      select: { id: true, userId: true, roleId: true, email: true, password: true, role: { select: { nombre: true, permisos: true } } },
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
        password: data.password,
        nombre: data.nombre,
        apellidos: data.apellidos,
        telefono: data.telefono,
        nombreEmpresa: data.nombreEmpresa,
      },
    });
  }

  async upsertRegistroPendiente(data: RegistroPendienteData): Promise<void> {
    const registro = {
      codigo: data.codigo,
      password: data.password,
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
        anio: String(new Date().getFullYear()),
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
    return prisma.userRole.findFirst({
      where: { email },
      select: { email: true, nombre: true, apellidos: true, telefono: true, tipoUsuarioId: true, idEmpresa: true, nombreEmpresa: true },
    });
  }

  async updatePerfil(email: string, data: { nombre?: string; apellidos?: string; telefono?: string; tipoUsuarioId?: number | null; idEmpresa?: string | null; nombreEmpresa?: string | null }) {
    await prisma.userRole.updateMany({ where: { email }, data });
  }

  async findForReset(email: string) {
    return prisma.userRole.findFirst({
      where: { email },
      select: { id: true, email: true, nombre: true },
    });
  }

  async setResetToken(id: string, token: string, expires: Date) {
    await prisma.userRole.update({ where: { id }, data: { resetToken: token, resetTokenExpires: expires } });
  }

  async findByResetToken(token: string) {
    return prisma.userRole.findFirst({
      where: { resetToken: token, resetTokenExpires: { gte: new Date() } },
      select: { id: true },
    });
  }

  async updatePassword(id: string, password: string) {
    await prisma.userRole.update({ where: { id }, data: { password, resetToken: null, resetTokenExpires: null } });
  }
}
