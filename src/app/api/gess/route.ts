import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { GessStand } from "@/types/reserva";

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { id: string; bloqueId: string | null };

    if (!body.id) {
      return NextResponse.json({ error: "id es requerido" }, { status: 400 });
    }

    const updated = await prisma.gessStand.update({
      where: { id: body.id },
      data: { bloqueId: body.bloqueId },
    });

    return NextResponse.json(updated as unknown as GessStand);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventoId = searchParams.get("eventoId");
    const bloqueId = searchParams.get("bloqueId");

    if (bloqueId) {
      const stand = await prisma.gessStand.findFirst({
        where: { bloqueId },
        orderBy: { updatedAt: "desc" },
      });
      return NextResponse.json(stand as unknown as GessStand | null);
    }

    const where = eventoId ? { eventoId } : {};

    const stands = await prisma.gessStand.findMany({
      where,
      orderBy: { standCode: "asc" },
    });

    return NextResponse.json(stands as unknown as GessStand[]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
