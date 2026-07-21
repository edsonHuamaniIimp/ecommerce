import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { id?: string; permisos?: string[] };
    if (!body.id || !Array.isArray(body.permisos)) {
      return NextResponse.json({ error: "id y permisos requeridos" }, { status: 400 });
    }

    const updated = await prisma.role.update({
      where: { id: body.id },
      data: { permisos: body.permisos },
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
