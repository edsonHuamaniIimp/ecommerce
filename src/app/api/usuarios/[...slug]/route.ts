import { createRouter } from "@/lib/server/router";
import { usuariosController } from "@/controllers/usuarios.controller";

export const { GET, POST } = createRouter({
  GET: {
    listar: (req) => usuariosController.listar(req),
    personas: (req) => usuariosController.buscarPersonas(req),
  },
  POST: {
    crear: (req) => usuariosController.crear(req),
    "crear-lote": (req) => usuariosController.crearLote(req),
    "crear-cuenta": (req) => usuariosController.crearCuenta(req),
    actualizar: (req) => usuariosController.actualizar(req),
    "enviar-accesos": (req) => usuariosController.enviarAccesos(req),
  },
});
