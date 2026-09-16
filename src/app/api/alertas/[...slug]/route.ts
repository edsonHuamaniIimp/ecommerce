import { createRouter } from "@/lib/server/router";
import { alertasController } from "@/controllers/alertas.controller";

export const { GET, POST } = createRouter({
  GET: {
    listar: (req) => alertasController.listar(req),
  },
  POST: {
    "marcar-leida": (req) => alertasController.marcarLeida(req),
    "marcar-todas-leidas": (req) => alertasController.marcarTodasLeidas(req),
  },
});
