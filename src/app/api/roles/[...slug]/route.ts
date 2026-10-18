import { createRouter } from "@/lib/server/router";
import { rolesController } from "@/controllers/roles.controller";

export const { GET, POST, PATCH, DELETE } = createRouter({
  GET: {
    listar: () => rolesController.listar(),
    usuarios: (req) => rolesController.listarUsuarios(req),
  },
  POST: {
    crear: (req) => rolesController.crear(req),
    "add-user": (req) => rolesController.addUser(req),
  },
  PATCH: {
    "update-permisos": (req) => rolesController.actualizarPermisos(req),
    "update-modulos": (req) => rolesController.actualizarModulos(req),
  },
  DELETE: {
    "remove-user": (req) => rolesController.removeUser(req),
  },
});
