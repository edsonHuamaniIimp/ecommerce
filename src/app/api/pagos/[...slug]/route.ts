import { createRouter } from "@/lib/server/router";
import { pagosController } from "@/controllers/pagos.controller";

export const { GET, POST } = createRouter({
  GET: {
    listar: (req) => pagosController.listar(req),
    detalle: (req) => pagosController.detalle(req),
  },
  POST: {
    "agregar-cuota": (req) => pagosController.agregarCuota(req),
    "actualizar-cuota": (req) => pagosController.actualizarCuota(req),
    "adjuntar-voucher": (req) => pagosController.adjuntarVoucher(req),
    "eliminar-cuota": (req) => pagosController.eliminarCuota(req),
  },
});
