import { prisma } from "@/lib/server/db";
import type { IRoleRepository } from "@/domain/ports/role-repository";

export class RolePrismaRepository implements IRoleRepository {
  async findAll() {
    const rows = await prisma.role.findMany({
      include: { usuarios: { select: { id: true, userId: true, email: true, roleId: true } } },
      orderBy: { nombre: "asc" },
    });
    return rows;
  }

  async create(nombre: string, descripcion: string | null, permisos: string[]) {
    const row = await prisma.role.create({ data: { nombre, descripcion, permisos } });
    return { ...row, usuarios: [] };
  }

  async addUser(email: string, roleId: string) {
    const row = await prisma.userRole.create({ data: { email, userId: `user|${email}`, roleId } });
    return row;
  }

  async removeUser(userId: string, roleId: string) {
    await prisma.userRole.deleteMany({ where: { id: userId, roleId } });
  }

  async updatePermisos(id: string, permisos: string[]) {
    const row = await prisma.role.update({ where: { id }, data: { permisos } });
    return { ...row, usuarios: [] };
  }
}
