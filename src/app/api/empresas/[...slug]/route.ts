import { createRouter } from "@/lib/server/router";
import { empresaController } from "@/controllers/empresa.controller";

export const { GET, POST } = createRouter({
  GET: {
    listar: (req) => empresaController.listar(req),
    detalle: (req) => empresaController.detalle(req),
  },
  POST: {
    crear: (req) => empresaController.crear(req),
    actualizar: (req) => empresaController.actualizar(req),
    estado: (req) => empresaController.estado(req),
    "crear-cuenta": (req) => empresaController.crearCuenta(req),
    "reenviar-credenciales": (req) => empresaController.reenviarCredenciales(req),
    "carga-masiva/previsualizar": (req) => empresaController.cargaMasivaPrevisualizar(req),
    "carga-masiva/importar": (req) => empresaController.cargaMasivaImportar(req),
  },
});
