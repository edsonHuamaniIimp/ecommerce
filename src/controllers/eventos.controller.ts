import { NextResponse } from "next/server";
import { services } from "@/lib/services";
import { success, error } from "@/lib/api-response";
import { API_ERROR_CODES } from "@/lib/constants";
import { createEventoSchema, updateEventoSchema } from "@/validators/eventos.validator";

export const eventosController = {
  async listar(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("presala") === "1") {
      return success(await services.presala.listarPresala());
    }

    const id = searchParams.get("id");
    if (id) {
      const evento = await services.eventos.obtenerPorId(id);
      if (!evento) return error(API_ERROR_CODES.NOT_FOUND, "Evento no encontrado", 404);
      return success(evento);
    }

    return success(await services.presala.listarTodas());
  },

  async crear(request: Request): Promise<NextResponse> {
    const raw = await request.json();
    const body = createEventoSchema.parse(raw);
    return success(await services.eventos.crear({
      eventoPadreId: body.evento_padre_id,
      anio: body.anio,
      fechaInicio: body.fecha_inicio,
      fechaFin: body.fecha_fin,
    }), { status: 201 });
  },

  async actualizar(request: Request): Promise<NextResponse> {
    const raw = await request.json();
    const body = updateEventoSchema.parse(raw);
    return success(await services.eventos.actualizar(body));
  },
};
