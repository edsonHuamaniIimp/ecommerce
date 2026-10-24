import { createRouter } from "@/lib/server/router";
import { pagosController } from "@/controllers/pagos.controller";

export const { GET, POST } = createRouter({
  GET: {
    listar: (req) => pagosController.listar(req),
    factura: (req) => pagosController.factura(req),
    detalle: (req) => pagosController.detalle(req),
    archivos: (req) => pagosController.listarArchivos(req),
  },
  POST: {
    "agregar-cuota": (req) => pagosController.agregarCuota(req),
    "actualizar-cuota": (req) => pagosController.actualizarCuota(req),
    "adjuntar-voucher": (req) => pagosController.adjuntarVoucher(req),
    "eliminar-cuota": (req) => pagosController.eliminarCuota(req),
    "solicitar-factura": (req) => pagosController.solicitarFactura(req),
    "archivos-agregar": (req) => pagosController.agregarArchivo(req),
    "archivos-eliminar": (req) => pagosController.eliminarArchivo(req),
  },
});
