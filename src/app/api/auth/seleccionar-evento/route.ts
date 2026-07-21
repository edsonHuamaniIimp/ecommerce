import { NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken, signToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { eventoId?: string };
    if (!body.eventoId) {
      return NextResponse.json({ error: "eventoId requerido" }, { status: 400 });
    }

    const token = getTokenFromRequest(request as unknown as Parameters<typeof getTokenFromRequest>[0]);
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    const evento = await prisma.evento.findUnique({
      where: { id: body.eventoId },
      include: { eventoPadre: { select: { id: true, nombre: true, vertical: true } } },
    });
    if (!evento) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

    const newToken = await signToken({
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      roles: payload.roles,
      eventoId: evento.id,
      eventoPadreId: evento.eventoPadreId,
    });

    const res = NextResponse.json({ ok: true, eventoId: evento.id, eventoPadreId: evento.eventoPadreId });

    res.cookies.set("token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    });

    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
