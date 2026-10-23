import { createRouter } from "@/lib/server/router";
import { debidaDiligenciaController } from "@/controllers/debida-diligencia.controller";
import { ddMatrizEvaluacionController } from "@/controllers/dd-matriz-evaluacion.controller";

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
    "matriz-evaluacion": (req) => ddMatrizEvaluacionController.listar(req),
    "matriz-evaluacion/detalle": (req) => ddMatrizEvaluacionController.detalle(req),
    "matriz-evaluacion/abrir": (req) => ddMatrizEvaluacionController.abrir(req),
    "reputacion/listar": (req) => debidaDiligenciaController.reputacionListar(req),
  },
  POST: {
    guardar: (req) => debidaDiligenciaController.guardar(req),
    enviar: () => debidaDiligenciaController.enviar(),
    revisar: (req) => debidaDiligenciaController.revisar(req),
    "derivar-comunicaciones": (req) => debidaDiligenciaController.derivarComunicaciones(req),
    "legal/resolver": (req) => debidaDiligenciaController.resolverLegal(req),
    "reputacion/resolver": (req) => debidaDiligenciaController.reputacionResolver(req),
    "matriz-evaluacion/guardar": (req) => ddMatrizEvaluacionController.guardar(req),
    "matriz-evaluacion/vinculo": (req) => ddMatrizEvaluacionController.agregarVinculo(req),
    "matriz-evaluacion/vinculo/eliminar": (req) => ddMatrizEvaluacionController.eliminarVinculo(req),
    "matriz-evaluacion/adjunto/eliminar": (req) => ddMatrizEvaluacionController.eliminarAdjunto(req),
  },
});
