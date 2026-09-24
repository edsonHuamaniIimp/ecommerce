import { createRouter } from "@/lib/server/router";
import { dashboardController } from "@/controllers/dashboard.controller";

export const { GET } = createRouter({
  GET: {
    estadisticas: () => dashboardController.estadisticas(),
  },
});
