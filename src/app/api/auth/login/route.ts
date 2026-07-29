import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth";
import type { Rol } from "@/lib/constants";

type UserRoleWithRole = { role: { nombre: string; permisos: string[] } };

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; provider?: string };

    if (!body.email) {
      return NextResponse.json({ error: "email es requerido" }, { status: 400 });
    }

    const userRoles = await prisma.userRole.findMany({
      where: { email: body.email },
      include: { role: { select: { nombre: true, permisos: true } } },
    }) as UserRoleWithRole[];

    if (userRoles.length === 0) {
      return NextResponse.json({ error: "Usuario sin roles asignados" }, { status: 403 });
    }

    const roles = userRoles.map((ur) => ur.role.nombre as Rol);

    const token = await signToken({
      sub: `user|${body.email}`,
      email: body.email,
      name: body.email.split("@")[0] ?? body.email,
      roles,
    });

    const res = NextResponse.json({ token, roles, email: body.email });

    res.cookies.set("token", token, {
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
