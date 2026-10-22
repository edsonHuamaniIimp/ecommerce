import { createRouter } from "@/lib/server/router";
import { debidaDiligenciaController } from "@/controllers/debida-diligencia.controller";

export const { GET, POST } = createRouter({
  GET: {
    "mi-expediente": () => debidaDiligenciaController.miExpediente(),
    bandeja: (req) => debidaDiligenciaController.bandeja(req),
    "legal/bandeja": (req) => debidaDiligenciaController.bandejaLegal(req),
    clientes: (req) => debidaDiligenciaController.clientes(req),
    empresas: (req) => debidaDiligenciaController.empresas(req),
    detalle: (req) => debidaDiligenciaController.detalle(req),
    panel: () => debidaDiligenciaController.panel(),
    matriz: (req) => debidaDiligenciaController.matriz(req),
    "reputacion/listar": (req) => debidaDiligenciaController.reputacionListar(req),
  },
  POST: {
    guardar: (req) => debidaDiligenciaController.guardar(req),
    enviar: () => debidaDiligenciaController.enviar(),
    revisar: (req) => debidaDiligenciaController.revisar(req),
    "derivar-comunicaciones": (req) => debidaDiligenciaController.derivarComunicaciones(req),
    "legal/resolver": (req) => debidaDiligenciaController.resolverLegal(req),
    "reputacion/resolver": (req) => debidaDiligenciaController.reputacionResolver(req),
  },
});
