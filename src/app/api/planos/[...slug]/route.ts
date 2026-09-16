import { createRouter } from "@/lib/server/router";
import { planosController } from "@/controllers/planos.controller";

export const { GET, POST, PATCH, DELETE } = createRouter({
  GET: {
    listar: () => planosController.listar(),
    detalle: (req) => planosController.detalle(req),
    "planos-evento": (req) => planosController.planosDeEvento(req),
    "macros-de-plano": (req) => planosController.macrosDePlano(req),
    exportar: (req) => planosController.exportar(req),
    "exportar-ts": (req) => planosController.exportarTs(req),
    ocupacion: (req) => planosController.ocupacion(req),
  },
  POST: {
    crear: (req) => planosController.crear(req),
    "guardar-layout": (req) => planosController.guardarLayout(req),
    "guardar-secciones": (req) => planosController.guardarSecciones(req),
    "asignar-macro": (req) => planosController.asignarAMacro(req),
    "quitar-macro": (req) => planosController.quitarDeMacros(req),
    eliminar: (req) => planosController.eliminar(req),
    importar: (req) => planosController.importar(req),
  },
  PATCH: {
    "actualizar-meta": (req) => planosController.actualizarMeta(req),
  },
});
