import { createRouter } from "@/lib/server/router";
import { verComoController } from "@/controllers/ver-como.controller";

export const { GET, POST } = createRouter({
  GET: {
    empresas: (req) => verComoController.empresas(req),
  },
  POST: {
    seleccionar: (req) => verComoController.seleccionar(req),
  },
});
