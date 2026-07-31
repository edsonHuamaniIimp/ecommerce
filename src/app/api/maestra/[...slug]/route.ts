import { createRouter } from "@/lib/router";
import { maestraController } from "@/controllers/maestra.controller";

export const { GET } = createRouter({
  GET: {
    listar: (req) => maestraController.listar(req),
  },
});
