import { createRouter } from "@/lib/server/router";
import { reservaDatosController } from "@/controllers/reserva-datos.controller";

export const { GET } = createRouter({
  GET: {
    prellenar: (req) => reservaDatosController.prellenar(req),
  },
});
