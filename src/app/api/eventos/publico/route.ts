import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(err("VALIDATION", "id requerido"), { status: 400 });
  }

  try {
    const evento = await prisma.evento.findUnique({
      where: { id },
      select: { id: true, plano: true, anio: true, tipoEvento: true, codigoEvento: true, eventoPadre: { select: { nombre: true } } },
    });

    if (!evento) {
      return NextResponse.json(err("NOT_FOUND", "Evento no encontrado"), { status: 404 });
    }

    return NextResponse.json(ok(evento));
  } catch (error) {
    return NextResponse.json(err("INTERNAL", error instanceof Error ? error.message : "Error desconocido"), { status: 500 });
  }
}
