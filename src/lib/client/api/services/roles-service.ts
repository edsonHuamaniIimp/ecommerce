import 'client-only';

import { internalApi } from "./internal-api";
import type { UserRoleDTO } from "@/types/dto/models";

interface RoleData {
  id: string;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
  usuarios: { id: string; userId: string; email: string }[];
  count: number;
}

export const rolesService = {
  list() {
    return internalApi.get<RoleData[]>("/api/roles/listar");
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
};
