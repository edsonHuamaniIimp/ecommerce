import 'client-only';

import { internalApi } from "./internal-api";
import type { UserRoleDTO } from "@/types/dto/models";

interface RoleData {
  id: string;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
  modulos: string[];
  usuarios: { id: string; userId: string; email: string }[];
  count: number;
}

export interface RoleUserData {
  id: string;
  userId: string;
  email: string;
  roleId: string;
  roleNombre: string;
}

export interface RoleUsersResponse {
  data: RoleUserData[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export const rolesService = {
  list() {
    return internalApi.get<RoleData[]>("/api/roles/listar");
  },
  listarUsuarios(params: { page: number; perPage: number; search?: string; roleId?: string }) {
    const qs = new URLSearchParams();
    qs.set("page", String(params.page));
    qs.set("perPage", String(params.perPage));
    if (params.search) qs.set("search", params.search);
    if (params.roleId) qs.set("roleId", params.roleId);
    return internalApi.get<RoleUsersResponse>(`/api/roles/usuarios?${qs.toString()}`);
  },
  addUser(email: string, roleId: string) {
    return internalApi.post<UserRoleDTO>("/api/roles/add-user", { email, roleId });
  },
  removeUser(userId: string, roleId: string) {
    return internalApi.delete<void>(`/api/roles/remove-user?userId=${encodeURIComponent(userId)}&roleId=${encodeURIComponent(roleId)}`);
  },
  updatePermisos(id: string, permisos: string[]) {
    return internalApi.patch<RoleData>("/api/roles/update-permisos", { id, permisos });
  },
  updateModulos(id: string, modulos: string[]) {
    return internalApi.patch<RoleData>("/api/roles/update-modulos", { id, modulos });
  },
};
