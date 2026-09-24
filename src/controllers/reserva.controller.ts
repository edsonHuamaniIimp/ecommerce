import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { reservaRequestSchema } from "@/validators/reserva.validator";
import { getSession } from "@/lib/server/auth";

export const reservaController = {
  async crear(request: Request): Promise<NextResponse> {
    const session = await getSession();
    const raw = await request.json();
    const body = reservaRequestSchema.parse(raw);
    const result = await services.reservas.crear({
      ...body,
      userEmail: session?.email,
      userSub: session?.sub,
      eventoId: session?.eventoId,
    });
    if (!result.ok) {
      return error(API_ERROR_CODES.CONFLICT, "Algunos stands ya estan reservados", 409);
    }
    return success({ ok: true, message: result.message });
  },
};
