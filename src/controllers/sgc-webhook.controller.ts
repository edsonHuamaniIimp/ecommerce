import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { errorLogger } from "@/lib/server/error-logger";
import { API_ERROR_CODES, SGC_WEBHOOK_SIGNATURE_HEADER, SGC_WEBHOOK_DELIVERY_HEADER } from "@/lib/shared/constants";
import { getSgcWebhookSecret } from "@/lib/server/sgc-config";
import { diagnosticarFirmaSgc } from "@/lib/shared/utils/sgc";
import type { SgcWebhookPayload } from "@/domain/models/sgc";

/** Prefijo de los logs del receptor (buscable en CloudWatch y en `error_log`). */
const LOG = "[sgc-webhook]";

export const sgcWebhookController = {
  async recibir(request: Request): Promise<NextResponse> {
    const raw = await request.text();
    const header = request.headers.get(SGC_WEBHOOK_SIGNATURE_HEADER);
    const deliveryId = request.headers.get(SGC_WEBHOOK_DELIVERY_HEADER);
    const ruta = new URL(request.url).pathname;
    /* Diagnostico de entrega: sin cuerpo, firma ni secreto; solo metadatos. */
    const meta = { deliveryId, ruta, bytes: raw.length, conFirma: Boolean(header) };
    const motivo = await diagnosticarFirmaSgc({
      secret: getSgcWebhookSecret() ?? "",
      header,
      payload: raw,
      ahoraSegundos: Math.floor(Date.now() / 1000),
    });
    if (motivo) {
      /* Antes un rechazo no dejaba rastro: por eso no se pudo saber si el SGC dejo de
       * enviar o si la firma fallaba. Se registra en consola y en error_log. */
      console.warn(`${LOG} rechazado`, { ...meta, motivo });
      await errorLogger.log({ message: `${LOG} firma rechazada: ${motivo}`, url: ruta, metadata: { ...meta, motivo } });
      return error(API_ERROR_CODES.UNAUTHORIZED, "Firma invalida", 401);
    }

    let payload: SgcWebhookPayload;
    try {
      payload = JSON.parse(raw) as SgcWebhookPayload;
    } catch {
      console.warn(`${LOG} payload invalido`, meta);
      await errorLogger.log({ message: `${LOG} payload invalido`, url: ruta, metadata: meta });
      return error(API_ERROR_CODES.VALIDATION, "Payload invalido", 400);
    }

    const evento = { ...meta, tipo: payload.eventType ?? null, eventId: payload.eventId ?? null };
    try {
      const resultado = await services.sgcWebhook.procesar(payload, deliveryId);
      if (!resultado.recibido) {
        console.warn(`${LOG} evento invalido`, evento);
        await errorLogger.log({ message: `${LOG} evento invalido`, url: ruta, metadata: evento });
        return error(API_ERROR_CODES.VALIDATION, "Evento invalido", 400);
      }
      console.info(`${LOG} recibido`, { ...evento, duplicado: resultado.duplicado });
      return success({ ok: true, duplicado: resultado.duplicado });
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error desconocido";
      console.error(`${LOG} error al procesar`, { ...evento, mensaje });
      await errorLogger.log({
        message: `${LOG} error al procesar: ${mensaje}`.slice(0, 1000),
        stack: err instanceof Error ? err.stack : undefined,
        url: ruta,
        metadata: evento,
      });
      throw err;
    }
  },
};
