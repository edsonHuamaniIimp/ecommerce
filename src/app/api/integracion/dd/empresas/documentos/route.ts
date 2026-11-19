import { ddIntegracionController } from "@/controllers/dd-integracion.controller";

export const runtime = "nodejs";

export const GET = ddIntegracionController.documentos;
