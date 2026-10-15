import { sgcWebhookController } from "@/controllers/sgc-webhook.controller";

export const runtime = "nodejs";

/**
 * Alias del receptor de webhooks del SGC. La suscripcion del SGC apunta a
 * `https://ecommerce.sistemasiimp.org.pe/sgc` (guia §6.5); el endpoint canonico
 * es `/api/integracion/sgc/webhook`. Ambas rutas despachan al mismo controller.
 */
export const POST = sgcWebhookController.recibir;
