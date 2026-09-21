import { sgcCronController } from "@/controllers/sgc-cron.controller";

export const runtime = "nodejs";

export const POST = sgcCronController.reconciliar;
