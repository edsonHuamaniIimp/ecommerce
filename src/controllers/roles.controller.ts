import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";

export const rolesController = {
  async listar(): Promise<NextResponse> {
    return success(await services.roleRepo.findAll());
  },

  /** @request { nombre: string, descripcion?: string, permisos?: string[] } */
  async crear(request: Request): Promise<NextResponse> {
    const body = await request.json() as { nombre?: string; descripcion?: string; permisos?: string[] };
    if (!body.nombre) return error(API_ERROR_CODES.VALIDATION, "nombre requerido", 400);
    return success(await services.roleRepo.create(body.nombre, body.descripcion ?? null, body.permisos ?? []), { status: 201 });
  },

  /** @request { id: string, permisos: string[] } */
  async actualizarPermisos(request: Request): Promise<NextResponse> {
    const body = await request.json() as { id?: string; permisos?: string[] };
    if (!body.id || !Array.isArray(body.permisos)) return error(API_ERROR_CODES.VALIDATION, "id y permisos requeridos", 400);
    return success(await services.roleRepo.updatePermisos(body.id, body.permisos));
  },

  /** @request { email: string, roleId: string } */
  async addUser(request: Request): Promise<NextResponse> {
    const body = await request.json() as { email?: string; roleId?: string };
    if (!body.email || !body.roleId) return error(API_ERROR_CODES.VALIDATION, "email y roleId requeridos", 400);
    return success(await services.roleRepo.addUser(body.email, body.roleId), { status: 201 });
  },

  /** @request { userId: string, roleId: string } */
  async removeUser(request: Request): Promise<NextResponse> {
    const body = await request.json() as { userId?: string; roleId?: string };
    if (!body.userId || !body.roleId) return error(API_ERROR_CODES.VALIDATION, "userId y roleId requeridos", 400);
    await services.roleRepo.removeUser(body.userId, body.roleId);
    return success({ ok: true });
  },
};
