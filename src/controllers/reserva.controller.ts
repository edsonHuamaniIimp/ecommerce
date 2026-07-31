import { NextResponse } from "next/server";
import { services } from "@/lib/services";
import { success, error } from "@/lib/api-response";
import { API_ERROR_CODES } from "@/lib/constants";
import { reservaRequestSchema } from "@/validators/reserva.validator";

export const reservaController = {
  async crear(request: Request): Promise<NextResponse> {
    const raw = await request.json();
    const body = reservaRequestSchema.parse(raw);
    const result = await services.reservas.crear(body);
    if (!result.ok) {
      return error(API_ERROR_CODES.CONFLICT, "Algunos stands ya estan reservados", 409);
    }
    return success({ ok: true, message: result.message });
  },
};
