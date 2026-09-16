import { createRouter } from "@/lib/server/router";
import { kbServiciosController } from "@/controllers/kbservicios.controller";

export const { POST } = createRouter({
  POST: {
    events: (req) => kbServiciosController.listarEventos(req),
    "event-types": () => kbServiciosController.listarTipos(),
  },
});
