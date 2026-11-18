import { createRouter } from "@/lib/server/router";
import { reservaController } from "@/controllers/reserva.controller";

export const { POST } = createRouter({
  POST: {
    crear: (req) => reservaController.crear(req),
    admin: (req) => reservaController.crearAdmin(req),
    hold: (req) => reservaController.crearHold(req),
    "liberar-hold": (req) => reservaController.liberarHold(req),
  },
});
