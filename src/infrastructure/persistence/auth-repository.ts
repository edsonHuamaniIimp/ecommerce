import { prisma } from "@/lib/db";
import type { IAuthRepository } from "@/domain/ports/auth-repository";

export class AuthPrismaRepository implements IAuthRepository {
  async findByEmail(email: string) {
    return prisma.userRole.findMany({
      where: { email },
      select: { id: true, userId: true, roleId: true, email: true, password: true, role: { select: { nombre: true, permisos: true } } },
    }) as unknown as Awaited<ReturnType<IAuthRepository["findByEmail"]>>;
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
    let ev = await prisma.evento.findFirst({
      where: { tipoEvento, codigoEvento },
      select: { id: true },
    });
    if (ev) return ev;

    // Create a minimal Evento record
    const padre = await prisma.eventoPadre.findFirst({ where: { codigo: String(tipoEvento) } })
      ?? await prisma.eventoPadre.create({ data: { codigo: String(tipoEvento), vertical: "api", nombre: `Evento ${tipoEvento}` } });

    ev = await prisma.evento.create({
      data: { eventoPadreId: padre.id, tipoEvento, codigoEvento, anio: String(new Date().getFullYear()) },
      select: { id: true },
    });
    return ev;
  }

  async findPerfilByEmail(email: string) {
    return prisma.userRole.findFirst({
      where: { email },
      select: { email: true, nombre: true, apellidos: true, telefono: true, tipoUsuarioId: true },
    });
  }

  async updatePerfil(email: string, data: { nombre?: string; apellidos?: string; telefono?: string; tipoUsuarioId?: number | null }) {
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
