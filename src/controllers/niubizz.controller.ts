import { NextResponse } from "next/server";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { getSession } from "@/lib/server/auth";
import { facturacionRepo } from "@/infrastructure/persistence/facturacion-repository";
import { NiubizzApplicationService } from "@/application/facturacion/niubizz-service";

const niubizzService = new NiubizzApplicationService(facturacionRepo);

export const niubizzController = {
  async crearSesion(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

    const { facturacionId } = (await request.json()) as { facturacionId: string };
    if (!facturacionId) return error(API_ERROR_CODES.VALIDATION, "facturacionId requerido", 400);

    try {
      const result = await niubizzService.crearSesion(facturacionId);
      return success({
        sessionToken: result.k,
        purchaseNumber: result.numero_orden ?? "",
        merchantId: process.env.NIUBIZZ_MERCHANT_ID,
        amount: result.amount,
        urlJs: process.env.NIUBIZZ_URL_JS,
      });
    } catch (e) {
      return error(API_ERROR_CODES.BAD_GATEWAY, e instanceof Error ? e.message : "Error Niubizz", 502);
    }
  },

  async confirmarPago(request: Request): Promise<NextResponse> {
    const { facturacionId, transactionToken } = (await request.json()) as { facturacionId: string; transactionToken: string };
    if (!facturacionId || !transactionToken) return error(API_ERROR_CODES.VALIDATION, "facturacionId y transactionToken requeridos", 400);

    try {
      await niubizzService.confirmarPago(facturacionId, transactionToken);
      return success({ ok: true });
    } catch (e) {
      return error(API_ERROR_CODES.BAD_GATEWAY, e instanceof Error ? e.message : "Error al confirmar", 502);
    }
  },
};
