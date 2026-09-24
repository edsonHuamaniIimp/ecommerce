import { createRouter } from "@/lib/server/router";
import { authController } from "@/controllers/auth.controller";
import { solicitudCuentaController } from "@/controllers/solicitud-cuenta.controller";

export const { GET, POST, PATCH } = createRouter({
  GET: {
    session: () => authController.session(),
    perfil: () => authController.getPerfil(),
  },
  POST: {
    login: (req) => authController.login(req),
    registro: (req) => authController.registro(req),
    "registro/confirmar": (req) => authController.confirmarRegistro(req),
    logout: () => authController.logout(),
    "seleccionar-evento": (req) => authController.seleccionarEvento(req),
    "reset-password": (req) => authController.requestReset(req),
    "reset-password/confirm": (req) => authController.confirmReset(req),
    "solicitar-cuenta": (req) => solicitudCuentaController.crear(req),
  },
  PATCH: {
    perfil: (req) => authController.updatePerfil(req),
  },
});
