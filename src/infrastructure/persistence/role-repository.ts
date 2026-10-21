import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/server/db";
import type { IRoleRepository } from "@/domain/ports/role-repository";

export class RolePrismaRepository implements IRoleRepository {
  async findAll() {
    const rows = await prisma.role.findMany({
      include: { _count: { select: { usuarios: true } } },
      orderBy: { nombre: "asc" },
    });
    return rows.map(({ _count, ...row }) => ({
      ...row,
      usuarios: [],
      count: _count.usuarios,
    }));
  }

  async findAllUsuarios(params: {
    page: number;
    perPage: number;
    search?: string;
    roleId?: string;
  }) {
    const where: {
      roleId?: string;
      OR?: Array<
        | { email: { contains: string; mode: "insensitive" } }
        | { role: { nombre: { contains: string; mode: "insensitive" } } }
      >;
    } = {};
    if (params.roleId) where.roleId = params.roleId;
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { role: { nombre: { contains: q, mode: "insensitive" } } },
      ];
    }
    const [rows, total] = await Promise.all([
      prisma.userRole.findMany({
        where,
        select: {
          id: true,
          userId: true,
          email: true,
          roleId: true,
          role: { select: { nombre: true } },
        },
        orderBy: { email: "asc" },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
      prisma.userRole.count({ where }),
    ]);
    return {
      data: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        email: row.email,
        roleId: row.roleId,
        roleNombre: row.role.nombre,
      })),
      total,
      page: params.page,
      perPage: params.perPage,
      totalPages: Math.ceil(total / params.perPage),
    };
  }

  async findById(id: string) {
    const row = await prisma.role.findUnique({ where: { id } });
    return row ? { ...row, usuarios: [] } : null;
  }

  async findByNombre(nombre: string) {
    const row = await prisma.role.findUnique({ where: { nombre } });
    return row ? { ...row, usuarios: [] } : null;
  }

  async create(nombre: string, descripcion: string | null, permisos: string[]) {
    const row = await prisma.role.create({ data: { nombre, descripcion, permisos } });
    return { ...row, usuarios: [] };
  }

  async addUser(email: string, roleId: string) {
    const existente = await prisma.userRole.findFirst({ where: { email }, select: { userId: true } });
    const row = await prisma.userRole.create({
      data: { email, userId: existente?.userId ?? randomUUID(), roleId },
    });
    return row;
  }

  async removeUser(userId: string, roleId: string) {
    await prisma.userRole.deleteMany({ where: { id: userId, roleId } });
  }

  async updatePermisos(id: string, permisos: string[]) {
    const row = await prisma.role.update({ where: { id }, data: { permisos } });
    return { ...row, usuarios: [] };
  }

  async updateModulos(id: string, modulos: string[], permisos: string[]) {
    const row = await prisma.role.update({
      where: { id },
      data: { modulos, permisos },
    });
    return { ...row, usuarios: [] };
  }
}
