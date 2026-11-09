import { createRouter } from "@/lib/server/router";
import { eventosController } from "@/controllers/eventos.controller";

export const { GET, POST, PATCH } = createRouter({
  GET: {
    listar: (req) => eventosController.listar(req),
    config: (req) => eventosController.config(req),
    "modal-info": (req) => eventosController.modalInfo(req),
  },
  POST: {
    crear: (req) => eventosController.crear(req),
  },
  PATCH: {
    actualizar: (req) => eventosController.actualizar(req),
  },
});
