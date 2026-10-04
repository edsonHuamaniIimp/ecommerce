import { createRouter } from "@/lib/server/router";
import { contratoController } from "@/controllers/contrato.controller";

export const { POST } = createRouter({
  POST: {
    generar: (req) => contratoController.generar(req),
    firmar: (req) => contratoController.firmar(req),
    borrador: (req) => contratoController.generarBorrador(req),
    "firmar-borrador": (req) => contratoController.firmarBorrador(req),
  },
});
