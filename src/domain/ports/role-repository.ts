import type { RoleEntity, RoleUsersParams, RoleUsersResult, UserRoleEntity } from "../models/entities";

export interface IRoleRepository {
  findAll(): Promise<RoleEntity[]>;
  findAllUsuarios(params: RoleUsersParams): Promise<RoleUsersResult>;
  findById(id: string): Promise<RoleEntity | null>;
  findByNombre(nombre: string): Promise<RoleEntity | null>;
  create(nombre: string, descripcion: string | null, permisos: string[]): Promise<RoleEntity>;
  addUser(email: string, roleId: string): Promise<UserRoleEntity>;
  removeUser(userId: string, roleId: string): Promise<void>;
  updatePermisos(id: string, permisos: string[]): Promise<RoleEntity>;
  updateModulos(id: string, modulos: string[], permisos: string[]): Promise<RoleEntity>;
}
