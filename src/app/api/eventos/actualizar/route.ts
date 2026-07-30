import { NextResponse } from "next/server";
import { services } from "@/lib/services";
import { ok, err } from "@/lib/api-response";

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { id?: string; estado?: string; anio?: string; fecha_inicio?: string | null; fecha_fin?: string | null; flg_activo?: boolean; flg_visible?: boolean; plano?: string };

    if (!body.id) {
      return NextResponse.json(err("VALIDATION", "id requerido"), { status: 400 });
    }

    const updateData: Parameters<typeof services.eventos.actualizar>[1] = {};

    if (body.estado !== undefined) updateData.estado = body.estado;
    if (body.anio !== undefined) updateData.anio = body.anio;
    if (body.fecha_inicio !== undefined) updateData.fechaInicio = body.fecha_inicio ? (new Date(body.fecha_inicio) as unknown as Date) : null;
    if (body.fecha_fin !== undefined) updateData.fechaFin = body.fecha_fin ? (new Date(body.fecha_fin) as unknown as Date) : null;
    if (body.flg_activo !== undefined) updateData.flgActivo = body.flg_activo;
    if (body.flg_visible !== undefined) updateData.flgVisible = body.flg_visible;
    if (body.plano !== undefined) updateData.plano = body.plano;

    await services.eventos.actualizar(body.id, updateData);
    const updated = await services.eventos.obtenerPorId(body.id);
    return NextResponse.json(ok(updated));
  } catch (error) {
    console.error("PATCH /api/eventos/actualizar:", error);
    return NextResponse.json(err("INTERNAL", error instanceof Error ? error.message : "Error desconocido"), { status: 500 });
  }
}
