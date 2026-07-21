import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; roleId?: string };

    if (!body.email || !body.roleId) {
      return NextResponse.json({ error: "email y roleId requeridos" }, { status: 400 });
    }

    const exists = await prisma.userRole.findFirst({
      where: { email: body.email, roleId: body.roleId },
    });
    if (exists) {
      return NextResponse.json({ error: "Usuario ya tiene este rol" }, { status: 409 });
    }

    const userRole = await prisma.userRole.create({
      data: { email: body.email, userId: `user|${body.email}`, roleId: body.roleId },
    });

    return NextResponse.json(userRole, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const roleId = searchParams.get("roleId");

    if (!userId || !roleId) {
      return NextResponse.json({ error: "userId y roleId requeridos" }, { status: 400 });
    }

    await prisma.userRole.deleteMany({
      where: { id: userId, roleId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
