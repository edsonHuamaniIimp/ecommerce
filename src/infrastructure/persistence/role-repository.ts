import { prisma } from "@/lib/server/db";
import type { IRoleRepository } from "@/domain/ports/role-repository";
import type { RoleEntity, UserRoleEntity } from "@/domain/models/entities";

export class RolePrismaRepository implements IRoleRepository {
  async findAll() {
    const rows = await prisma.role.findMany({
      include: { usuarios: { select: { id: true, userId: true, email: true } } },
      orderBy: { nombre: "asc" },
    });
    return rows as unknown as RoleEntity[];
  }

  async create(nombre: string, descripcion: string | null, permisos: string[]) {
    const row = await prisma.role.create({ data: { nombre, descripcion, permisos } });
    return row as unknown as RoleEntity;
  }

  async addUser(email: string, roleId: string) {
    const row = await prisma.userRole.create({ data: { email, userId: `user|${email}`, roleId } });
    return row as unknown as UserRoleEntity;
  }

  async removeUser(userId: string, roleId: string) {
    await prisma.userRole.deleteMany({ where: { id: userId, roleId } });
  }

  async updatePermisos(id: string, permisos: string[]) {
    const row = await prisma.role.update({ where: { id }, data: { permisos } });
    return row as unknown as RoleEntity;
  }
}
