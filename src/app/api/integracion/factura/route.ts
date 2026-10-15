import { integracionFacturaController } from "@/controllers/integracion-factura.controller";

export const runtime = "nodejs";

export const POST = integracionFacturaController.registrar;
