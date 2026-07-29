import { NextResponse } from "next/server";
import { services } from "@/lib/services";
import { ok, err } from "@/lib/api-response";

export async function GET() {
  try {
    const eventos = await services.eventos.listarTodas();
    return NextResponse.json(ok(eventos));
  } catch (error) {
    return NextResponse.json(err("INTERNAL", error instanceof Error ? error.message : "Error desconocido"), { status: 500 });
  }
}

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

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { id?: string; estado?: string; anio?: string; fechaInicio?: string | null; fechaFin?: string | null; flgActivo?: boolean };
    if (!body.id) {
      return NextResponse.json(err("VALIDATION", "id requerido"), { status: 400 });
    }

    await services.eventos.actualizar(body.id, {
      estado: body.estado,
      anio: body.anio,
      fechaInicio: body.fechaInicio ? (new Date(body.fechaInicio) as unknown as Date) : null,
      fechaFin: body.fechaFin ? (new Date(body.fechaFin) as unknown as Date) : null,
      flgActivo: body.flgActivo,
    });

    const updated = await services.eventos.obtenerPorId(body.id);
    return NextResponse.json(ok(updated));
  } catch (error) {
    console.error("PATCH /api/eventos:", error);
    return NextResponse.json(
      err("INTERNAL", error instanceof Error ? error.message : "Error desconocido", error instanceof Error ? String(error.stack).slice(0, 300) : undefined),
      { status: 500 },
    );
  }
}
