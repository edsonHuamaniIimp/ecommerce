import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const eventos = await prisma.evento.findMany({
    include: {
      eventoPadre: { select: { id: true, nombre: true, codigo: true } },
      _count: { select: { stands: true, gessStands: true, reservas: true } },
    },
    orderBy: [{ eventoPadre: { nombre: "asc" } }, { anio: "desc" }],
  });

  return NextResponse.json(eventos);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      eventoPadreId?: string;
      anio?: string;
      tipoEvento?: number;
      codigoEvento?: number;
      fechaInicio?: string;
      fechaFin?: string;
    };

    if (!body.eventoPadreId || !body.anio) {
      return NextResponse.json({ error: "eventoPadreId y anio requeridos" }, { status: 400 });
    }

    const maxCodigo = await prisma.evento.findFirst({
      where: { eventoPadreId: body.eventoPadreId },
      orderBy: { codigoEvento: "desc" },
      select: { codigoEvento: true },
    });

    const evento = await prisma.evento.create({
      data: {
        eventoPadreId: body.eventoPadreId,
        tipoEvento: body.tipoEvento ?? 0,
        codigoEvento: (maxCodigo?.codigoEvento ?? 0) + 1,
        anio: body.anio,
        estado: "draft",
        fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : undefined,
        fechaFin: body.fechaFin ? new Date(body.fechaFin) : undefined,
      },
      include: { eventoPadre: { select: { nombre: true } } },
    });

    return NextResponse.json(evento, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as {
      id?: string;
      estado?: string;
      anio?: string;
      fechaInicio?: string | null;
      fechaFin?: string | null;
      imagen?: string | null;
      flgActivo?: boolean;
    };
    if (!body.id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const updateData: {
      estado?: string;
      anio?: string;
      fechaInicio?: Date | null;
      fechaFin?: Date | null;
      imagen?: string | null;
      flgActivo?: boolean;
    } = {};

    if (body.estado !== undefined) updateData.estado = body.estado;
    if (body.anio !== undefined) updateData.anio = body.anio;
    if (body.fechaInicio !== undefined) updateData.fechaInicio = body.fechaInicio ? new Date(body.fechaInicio) : null;
    if (body.fechaFin !== undefined) updateData.fechaFin = body.fechaFin ? new Date(body.fechaFin) : null;
    if (body.imagen !== undefined) updateData.imagen = body.imagen;
    if (body.flgActivo !== undefined) updateData.flgActivo = body.flgActivo;

    await prisma.evento.update({ where: { id: body.id }, data: updateData });

    const updated = await prisma.evento.findUnique({
      where: { id: body.id },
      include: { eventoPadre: { select: { nombre: true } } },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/eventos:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
