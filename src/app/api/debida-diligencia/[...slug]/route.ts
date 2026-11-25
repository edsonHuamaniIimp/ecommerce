import { createRouter } from "@/lib/server/router";
import { debidaDiligenciaController } from "@/controllers/debida-diligencia.controller";
import { ddMatrizEvaluacionController } from "@/controllers/dd-matriz-evaluacion.controller";
import { ddConfiguracionController } from "@/controllers/dd-configuracion.controller";

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
    "matriz-evaluacion/resumen": (req) => ddMatrizEvaluacionController.resumen(req),
    "matriz-evaluacion/abrir": (req) => ddMatrizEvaluacionController.abrir(req),
    "matriz-evaluacion/automatizacion": (req) => ddMatrizEvaluacionController.estadoAutomatizacion(req),
    maestra: (req) => debidaDiligenciaController.maestraDd(req),
    "reputacion/listar": (req) => debidaDiligenciaController.reputacionListar(req),
    "configuracion": () => ddConfiguracionController.obtener(),
    "configuracion/auditoria": () => ddConfiguracionController.auditoria(),
  },
  POST: {
    nueva: () => debidaDiligenciaController.iniciarNueva(),
    guardar: (req) => debidaDiligenciaController.guardar(req),
    enviar: () => debidaDiligenciaController.enviar(),
    "regularizar-vigencia": (req) => debidaDiligenciaController.regularizarVigencia(req),
    revisar: (req) => debidaDiligenciaController.revisar(req),
    "derivar-comunicaciones": (req) => debidaDiligenciaController.derivarComunicaciones(req),
    "vinculos-completos": (req) => debidaDiligenciaController.declararVinculosCompletos(req),
    "legal/resolver": (req) => debidaDiligenciaController.resolverLegal(req),
    "reputacion/iniciar": (req) => debidaDiligenciaController.reputacionIniciar(req),
    "reputacion/observar": (req) => debidaDiligenciaController.reputacionObservar(req),
    "reputacion/resolver": (req) => debidaDiligenciaController.reputacionResolver(req),
    "configuracion": (req) => ddConfiguracionController.actualizar(req),
    "matriz-evaluacion/exportar": (req) => ddMatrizEvaluacionController.exportar(req),
    "matriz-evaluacion/automatizar": (req) => ddMatrizEvaluacionController.automatizar(req),
    "matriz-evaluacion/automatizar-todo": (req) => ddMatrizEvaluacionController.automatizarTodo(req),
    "matriz-evaluacion/asistente": (req) => ddMatrizEvaluacionController.asistente(req),
    "matriz-evaluacion/guardar": (req) => ddMatrizEvaluacionController.guardar(req),
    "matriz-evaluacion/vinculo": (req) => ddMatrizEvaluacionController.agregarVinculo(req),
    "matriz-evaluacion/vinculo/eliminar": (req) => ddMatrizEvaluacionController.eliminarVinculo(req),
    "matriz-evaluacion/adjunto/eliminar": (req) => ddMatrizEvaluacionController.eliminarAdjunto(req),
    "clasificar-archivos": (req) => debidaDiligenciaController.clasificarArchivos(req),
  },
});

