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
    return internalApi.get<RoleData[]>("/api/roles/list");
  },
  addUser(email: string, roleId: string) {
    return internalApi.post<UserRoleDTO>("/api/roles/usuarios", { email, roleId });
  },
  removeUser(userId: string, roleId: string) {
    return internalApi.delete<void>(`/api/roles/usuarios?userId=${encodeURIComponent(userId)}&roleId=${encodeURIComponent(roleId)}`);
  },
  updatePermisos(id: string, permisos: string[]) {
    return internalApi.patch<RoleData>("/api/roles", { id, permisos });
  },
};
