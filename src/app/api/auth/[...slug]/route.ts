import { createRouter } from "@/lib/server/router";
import { authController } from "@/controllers/auth.controller";

export const { GET, POST, PATCH } = createRouter({
  GET: {
    session: () => authController.session(),
    perfil: () => authController.getPerfil(),
  },
  POST: {
    login: (req) => authController.login(req),
    logout: () => authController.logout(),
    "seleccionar-evento": (req) => authController.seleccionarEvento(req),
    "reset-password": (req) => authController.requestReset(req),
    "reset-password/confirm": (req) => authController.confirmReset(req),
  },
  PATCH: {
    perfil: (req) => authController.updatePerfil(req),
  },
});
