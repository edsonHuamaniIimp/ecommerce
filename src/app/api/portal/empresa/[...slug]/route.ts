import { createRouter } from "@/lib/server/router";
import { portalEmpresaController } from "@/controllers/portal-empresa.controller";

export const { GET, POST } = createRouter({
  GET: {
    "mis-datos": () => portalEmpresaController.misDatos(),
  },
  POST: {
    validar: (req) => portalEmpresaController.validar(req),
  },
});
