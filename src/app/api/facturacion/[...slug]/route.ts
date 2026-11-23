import { createRouter } from "@/lib/server/router";
import { facturacionController } from "@/controllers/facturacion.controller";

export const { GET, POST, PATCH, DELETE } = createRouter({
  GET: {
    listar: (req) => facturacionController.listar(req),
    detalle: (req) => facturacionController.detalle(req),
    expediente: (req) => facturacionController.expediente(req),
    recordatorios: () => facturacionController.recordatorios(),
  },
  POST: {
    "agregar-cuota": (req) => facturacionController.agregarCuota(req),
    "pagar-cuota": (req) => facturacionController.pagarCuota(req),
    "adjuntar-comprobante": (req) => facturacionController.adjuntarComprobante(req),
    "eliminar-cuota": (req) => facturacionController.eliminarCuota(req),
    "recordatorios/enviar": (req) => facturacionController.enviarRecordatorios(req),
    "completar-requisitos": (req) => facturacionController.completarRequisitos(req),
    "solicitar-factura": (req) => facturacionController.solicitarFactura(req),
    "programar-factura": (req) => facturacionController.programarFactura(req),
    "cancelar-programada": (req) => facturacionController.cancelarProgramada(req),
  },
  PATCH: {
    actualizar: (req) => facturacionController.actualizar(req),
  },
  DELETE: {
    eliminar: (req) => facturacionController.eliminar(req),
  },
});
