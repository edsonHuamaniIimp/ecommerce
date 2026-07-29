import { NextResponse } from "next/server";
import { services } from "@/lib/services";
import { ok, err } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { evento_padre_id?: string; anio?: string; fecha_inicio?: string; fecha_fin?: string };
    if (!body.evento_padre_id || !body.anio) {
      return NextResponse.json(err("VALIDATION", "evento_padre_id y anio requeridos"), { status: 400 });
    }
    const evento = await services.eventos.crear({
      eventoPadreId: body.evento_padre_id,
      anio: body.anio,
      fechaInicio: body.fecha_inicio,
      fechaFin: body.fecha_fin,
    });
    return NextResponse.json(ok(evento), { status: 201 });
  } catch (error) {
    return NextResponse.json(err("INTERNAL", error instanceof Error ? error.message : "Error desconocido"), { status: 500 });
  }
}
