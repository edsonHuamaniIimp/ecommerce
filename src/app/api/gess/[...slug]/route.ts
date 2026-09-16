import { createRouter } from "@/lib/server/router";
import { gessController } from "@/controllers/gess.controller";

export const { GET, POST, PATCH } = createRouter({
  GET: {
    listar: (req) => gessController.listar(req),
  },
  POST: {
    sync: (req) => gessController.sync(req),
    mockup: (req) => gessController.mockup(req),
  },
  PATCH: {
    actualizar: (req) => gessController.actualizar(req),
  },
});
