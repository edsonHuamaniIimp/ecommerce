import { createRouter } from "@/lib/server/router";
import { rolesController } from "@/controllers/roles.controller";

export const { GET, POST, PATCH, DELETE } = createRouter({
  GET: {
    listar: () => rolesController.listar(),
  },
  POST: {
    crear: (req) => rolesController.crear(req),
    "add-user": (req) => rolesController.addUser(req),
  },
  PATCH: {
    "update-permisos": (req) => rolesController.actualizarPermisos(req),
  },
  DELETE: {
    "remove-user": (req) => rolesController.removeUser(req),
  },
});
