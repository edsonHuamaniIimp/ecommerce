import { createRouter } from "@/lib/server/router";
import { sunatController } from "@/controllers/consultas.controller";

export const { GET } = createRouter({
  GET: {
    ruc: (req) => sunatController.consultarRuc(req),
  },
});
