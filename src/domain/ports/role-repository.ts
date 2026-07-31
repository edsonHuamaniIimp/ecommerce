import type { RoleEntity, UserRoleEntity } from "../models/entities";

export interface IRoleRepository {
  findAll(): Promise<RoleEntity[]>;
  create(nombre: string, descripcion: string | null, permisos: string[]): Promise<RoleEntity>;
  addUser(email: string, roleId: string): Promise<UserRoleEntity>;
  removeUser(userId: string, roleId: string): Promise<void>;
  updatePermisos(id: string, permisos: string[]): Promise<RoleEntity>;
}
