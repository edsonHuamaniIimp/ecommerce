import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES, SGC_WEBHOOK_SIGNATURE_HEADER } from "@/lib/shared/constants";
import { getSgcWebhookSecret } from "@/lib/server/sgc-config";
import { verificarFirmaSgc } from "@/lib/shared/utils/sgc";
import type { SgcWebhookPayload } from "@/domain/models/sgc";

export const sgcWebhookController = {
  async recibir(request: Request): Promise<NextResponse> {
    const raw = await request.text();
    const header = request.headers.get(SGC_WEBHOOK_SIGNATURE_HEADER);
    const valido = await verificarFirmaSgc({
      secret: getSgcWebhookSecret() ?? "",
      header,
      payload: raw,
      ahoraSegundos: Math.floor(Date.now() / 1000),
    });
    if (!valido) return error(API_ERROR_CODES.UNAUTHORIZED, "Firma invalida", 401);

    let payload: SgcWebhookPayload;
    try {
      payload = JSON.parse(raw) as SgcWebhookPayload;
    } catch {
      return error(API_ERROR_CODES.VALIDATION, "Payload invalido", 400);
    }

    const resultado = await services.sgcWebhook.procesar(payload);
    if (!resultado.recibido) return error(API_ERROR_CODES.VALIDATION, "Evento invalido", 400);
    return success({ ok: true, duplicado: resultado.duplicado });
  },
};
