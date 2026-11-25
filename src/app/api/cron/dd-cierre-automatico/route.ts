import { ddCierreCronController } from "@/controllers/dd-cierre-cron.controller";

export const runtime = "nodejs";

export const POST = ddCierreCronController.ejecutar;
