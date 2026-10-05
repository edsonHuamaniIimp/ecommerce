import { createRouter } from "@/lib/server/router";
import { gessController } from "@/controllers/gess.controller";

export const { GET, POST, PATCH, DELETE } = createRouter({
  GET: {
    listar: (req) => gessController.listar(req),
    "tipos-imagen": () => gessController.tiposImagenListar(),
  },
  POST: {
    sync: (req) => gessController.sync(req),
    mockup: (req) => gessController.mockup(req),
    "pre-reservar": (req) => gessController.preReservar(req),
    liberar: (req) => gessController.liberar(req),
    "tipos-imagen": (req) => gessController.tiposImagenGuardar(req),
  },
  PATCH: {
    actualizar: (req) => gessController.actualizar(req),
    "pre-reserva": (req) => gessController.actualizarPreReserva(req),
  },
  DELETE: {
    "tipos-imagen": (req) => gessController.tiposImagenEliminar(req),
  },
});
