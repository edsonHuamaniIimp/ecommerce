import { createRouter } from "@/lib/server/router";
import { facturacionController } from "@/controllers/facturacion.controller";

export const { GET, POST, PATCH, DELETE } = createRouter({
  GET: {
    listar: (req) => facturacionController.listar(req),
    detalle: (req) => facturacionController.detalle(req),
  },
  POST: {
    "agregar-cuota": (req) => facturacionController.agregarCuota(req),
    "pagar-cuota": (req) => facturacionController.pagarCuota(req),
    "eliminar-cuota": (req) => facturacionController.eliminarCuota(req),
  },
  PATCH: {
    actualizar: (req) => facturacionController.actualizar(req),
  },
  DELETE: {
    eliminar: (req) => facturacionController.eliminar(req),
  },
});
