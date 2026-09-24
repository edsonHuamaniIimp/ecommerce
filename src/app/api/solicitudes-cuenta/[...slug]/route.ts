import { createRouter } from "@/lib/server/router";
import { solicitudCuentaController } from "@/controllers/solicitud-cuenta.controller";

export const { GET, PATCH } = createRouter({
  GET: {
    listar: (req) => solicitudCuentaController.listar(req),
  },
  PATCH: {
    revisar: (req) => solicitudCuentaController.revisar(req),
  },
});
