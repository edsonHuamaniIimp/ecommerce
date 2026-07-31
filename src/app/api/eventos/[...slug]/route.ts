import { createRouter } from "@/lib/router";
import { eventosController } from "@/controllers/eventos.controller";

export const { GET, POST, PATCH } = createRouter({
  GET: {
    listar: (req) => eventosController.listar(req),
  },
  POST: {
    crear: (req) => eventosController.crear(req),
  },
  PATCH: {
    actualizar: (req) => eventosController.actualizar(req),
  },
});
