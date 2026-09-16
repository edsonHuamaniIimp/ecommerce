import { createRouter } from "@/lib/server/router";
import { reservaController } from "@/controllers/reserva.controller";

export const { POST } = createRouter({
  POST: {
    crear: (req) => reservaController.crear(req),
  },
});
