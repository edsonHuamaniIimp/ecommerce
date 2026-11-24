import { facturacionProgramadaCronController } from "@/controllers/facturacion-programada-cron.controller";

export const runtime = "nodejs";

export const POST = facturacionProgramadaCronController.ejecutar;
