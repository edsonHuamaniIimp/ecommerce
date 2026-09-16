import { createRouter } from "@/lib/server/router";
import { reniecController } from "@/controllers/consultas.controller";

export const { GET } = createRouter({
  GET: {
    dni: (req) => reniecController.consultarDni(req),
  },
});
