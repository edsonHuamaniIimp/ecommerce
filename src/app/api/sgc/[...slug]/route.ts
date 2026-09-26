import { createRouter } from "@/lib/server/router";
import { sgcController } from "@/controllers/sgc.controller";

export const { GET, POST } = createRouter({
  GET: {
    detalle: (req) => sgcController.detalle(req),
    descarga: (req) => sgcController.descarga(req),
  },
  POST: {
    sincronizar: () => sgcController.sincronizar(),
    subsanar: (req) => sgcController.subsanar(req),
    registrar: (req) => sgcController.registrar(req),
    "subir-documento": (req) => sgcController.subirDocumento(req),
    "subir-anexos": (req) => sgcController.subirAnexos(req),
    "subir-contrato": (req) => sgcController.subirContrato(req),
    "subsanacion-motivo": (req) => sgcController.declararMotivo(req),
    reenviar: (req) => sgcController.reenviar(req),
  },
});
