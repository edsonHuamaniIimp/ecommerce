import { createRouter } from "@/lib/server/router";
import { solicitudesController } from "@/controllers/solicitudes.controller";

export const { GET, POST } = createRouter({
  GET: {
    listar: (req) => solicitudesController.listar(req),
    detalle: (req) => solicitudesController.detalle(req),
    historial: (req) => solicitudesController.historial(req),
  },
  POST: {
    revisar: (req) => solicitudesController.revisar(req),
    notificar: (req) => solicitudesController.notificar(req),
    modificar: (req) => solicitudesController.modificar(req),
    reevaluar: (req) => solicitudesController.reevaluar(req),
    "atender-reevaluacion": (req) => solicitudesController.atenderReevaluacion(req),
    baja: (req) => solicitudesController.darDeBaja(req),
    "orden-pago": (req) => solicitudesController.ordenPago(req),
    "upload-doc": (req) => solicitudesController.uploadDocumento(req),
    "eliminar-doc": (req) => solicitudesController.eliminarDocumento(req),
  },
});
