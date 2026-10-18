import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import {
  ALL_PERMISSIONS,
  API_ERROR_CODES,
  PERMISSION_SECTIONS,
  ROLES_USUARIOS_PER_PAGE_DEFAULT,
  ROLES_USUARIOS_PER_PAGE_MAX,
} from "@/lib/shared/constants";

const MODULOS_VALIDOS = new Set<string>(Object.values(PERMISSION_SECTIONS));
const SECCION_POR_PERMISO = new Map<string, string>(
  ALL_PERMISSIONS.map((permiso) => [permiso.key, permiso.section]),
);

export const rolesController = {
  async listar(): Promise<NextResponse> {
    return success(await services.roleRepo.findAll());
  },

  async listarUsuarios(request: Request): Promise<NextResponse> {
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number(params.get("page")) || 1);
    const perPage = Math.min(
      ROLES_USUARIOS_PER_PAGE_MAX,
      Math.max(1, Number(params.get("perPage")) || ROLES_USUARIOS_PER_PAGE_DEFAULT),
    );
    const search = params.get("search")?.trim() || undefined;
    const roleId = params.get("roleId")?.trim() || undefined;
    return success(
      await services.roleRepo.findAllUsuarios({ page, perPage, search, roleId }),
    );
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

  /** @request { id: string, modulos: string[] } */
  async actualizarModulos(request: Request): Promise<NextResponse> {
    const body = await request.json() as { id?: string; modulos?: string[] };
    if (!body.id || !Array.isArray(body.modulos)) {
      return error(API_ERROR_CODES.VALIDATION, "id y modulos requeridos", 400);
    }
    const modulos = [...new Set(body.modulos.filter((modulo) => MODULOS_VALIDOS.has(modulo)))];
    if (modulos.length !== new Set(body.modulos).size) {
      return error(API_ERROR_CODES.VALIDATION, "Modulo invalido", 400);
    }
    const role = await services.roleRepo.findById(body.id);
    if (!role) return error(API_ERROR_CODES.NOT_FOUND, "Rol no encontrado", 404);
    const secciones = new Set(modulos);
    const permisos = role.permisos.filter(
      (permiso) => permiso === "admin:full" || secciones.has(SECCION_POR_PERMISO.get(permiso) ?? ""),
    );
    return success(await services.roleRepo.updateModulos(body.id, modulos, permisos));
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
