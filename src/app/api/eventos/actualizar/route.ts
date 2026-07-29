import { NextResponse } from "next/server";
import { services } from "@/lib/services";
import { ok, err } from "@/lib/api-response";

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { id?: string; estado?: string; anio?: string; fecha_inicio?: string | null; fecha_fin?: string | null; flg_activo?: boolean };
    if (!body.id) {
      return NextResponse.json(err("VALIDATION", "id requerido"), { status: 400 });
    }

    await services.eventos.actualizar(body.id, {
      estado: body.estado,
      anio: body.anio,
      fechaInicio: body.fecha_inicio ? (new Date(body.fecha_inicio) as unknown as Date) : null,
      fechaFin: body.fecha_fin ? (new Date(body.fecha_fin) as unknown as Date) : null,
      flgActivo: body.flg_activo,
    });

    const updated = await services.eventos.obtenerPorId(body.id);
    return NextResponse.json(ok(updated));
  } catch (error) {
    return NextResponse.json(err("INTERNAL", error instanceof Error ? error.message : "Error desconocido"), { status: 500 });
  }
}
