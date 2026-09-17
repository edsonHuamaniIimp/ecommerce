import { sgcWebhookController } from "@/controllers/sgc-webhook.controller";

export const runtime = "nodejs";

export const POST = sgcWebhookController.recibir;
