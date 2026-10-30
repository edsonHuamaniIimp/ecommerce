import { createRouter } from "@/lib/server/router";
import { reportesController } from "@/controllers/reportes.controller";

export const { GET } = createRouter({
  GET: {
    "solicitudes-por-pais": (request) => reportesController.solicitudesPorPais(request),
    "empresas-por-pais": (request) => reportesController.empresasPorPais(request),
    "mapa-pabellones": (request) => reportesController.mapaPabellones(request),
  },
});
