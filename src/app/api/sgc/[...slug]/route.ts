import { createRouter } from "@/lib/server/router";
import { sgcController } from "@/controllers/sgc.controller";

export const { GET, POST } = createRouter({
  GET: {
    detalle: (req) => sgcController.detalle(req),
    descarga: (req) => sgcController.descarga(req),
  },
  POST: {
    sincronizar: () => sgcController.sincronizar(),
    subsanar: (req) => sgcController.subsanar(req),
  },
});
