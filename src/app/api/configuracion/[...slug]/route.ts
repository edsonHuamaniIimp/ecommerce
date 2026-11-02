import { createRouter } from "@/lib/server/router";
import { configuracionController } from "@/controllers/configuracion.controller";

export const { GET, POST } = createRouter({
  GET: {
    "notificaciones-solicitudes": () => configuracionController.obtenerNotificacionesSolicitudes(),
  },
  POST: {
    "notificaciones-solicitudes": (request) => configuracionController.actualizarNotificacionesSolicitudes(request),
  },
});
