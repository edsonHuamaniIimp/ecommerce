import { createRouter } from "@/lib/server/router";
import { debidaDiligenciaController } from "@/controllers/debida-diligencia.controller";
import { ddMatrizEvaluacionController } from "@/controllers/dd-matriz-evaluacion.controller";

export const { GET, POST } = createRouter({
  GET: {
    "mi-expediente": (req) => debidaDiligenciaController.miExpediente(req),
    "mis-expedientes": (req) => debidaDiligenciaController.misExpedientes(req),
    bandeja: (req) => debidaDiligenciaController.bandeja(req),
    "legal/bandeja": (req) => debidaDiligenciaController.bandejaLegal(req),
    clientes: (req) => debidaDiligenciaController.clientes(req),
    empresas: (req) => debidaDiligenciaController.empresas(req),
    detalle: (req) => debidaDiligenciaController.detalle(req),
    historial: (req) => debidaDiligenciaController.historial(req),
    panel: (req) => debidaDiligenciaController.panel(req),
    matriz: (req) => debidaDiligenciaController.matriz(req),
    "matriz-evaluacion": (req) => ddMatrizEvaluacionController.listar(req),
    "matriz-evaluacion/detalle": (req) => ddMatrizEvaluacionController.detalle(req),
    "matriz-evaluacion/resumen": () => ddMatrizEvaluacionController.resumen(),
    "matriz-evaluacion/abrir": (req) => ddMatrizEvaluacionController.abrir(req),
    "reputacion/listar": (req) => debidaDiligenciaController.reputacionListar(req),
  },
  POST: {
    nueva: () => debidaDiligenciaController.iniciarNueva(),
    guardar: (req) => debidaDiligenciaController.guardar(req),
    enviar: () => debidaDiligenciaController.enviar(),
    "regularizar-vigencia": (req) => debidaDiligenciaController.regularizarVigencia(req),
    revisar: (req) => debidaDiligenciaController.revisar(req),
    "derivar-comunicaciones": (req) => debidaDiligenciaController.derivarComunicaciones(req),
    "legal/resolver": (req) => debidaDiligenciaController.resolverLegal(req),
    "reputacion/resolver": (req) => debidaDiligenciaController.reputacionResolver(req),
    "matriz-evaluacion/exportar": (req) => ddMatrizEvaluacionController.exportar(req),
    "matriz-evaluacion/guardar": (req) => ddMatrizEvaluacionController.guardar(req),
    "matriz-evaluacion/vinculo": (req) => ddMatrizEvaluacionController.agregarVinculo(req),
    "matriz-evaluacion/vinculo/eliminar": (req) => ddMatrizEvaluacionController.eliminarVinculo(req),
    "matriz-evaluacion/adjunto/eliminar": (req) => ddMatrizEvaluacionController.eliminarAdjunto(req),
  },
});
