import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ authenticated: false });

    let eventoNombre = null;
    if (session.eventoId) {
      const ev = await prisma.evento.findUnique({
        where: { id: session.eventoId },
        include: { eventoPadre: { select: { nombre: true } } },
      });
      if (ev) {
        eventoNombre = `${ev.eventoPadre.nombre} ${ev.anio}`;
      }
    }

    return NextResponse.json({
      authenticated: true,
      email: session.email,
      roles: session.roles,
      permissions: session.permissions,
      eventoId: session.eventoId ?? null,
      eventoPadreId: session.eventoPadreId ?? null,
      eventoNombre,
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
