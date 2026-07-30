import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { GessStand } from "@/types/reserva";
import { parsePagination, buildSearchFilter, paginatedResponse } from "@/lib/pagination";

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { id: string; bloqueId?: string | null; documentos?: string[]; imagenes?: string[]; estado?: string };

    if (!body.id) {
      return NextResponse.json({ error: "id es requerido" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.bloqueId !== undefined) data.bloqueId = body.bloqueId;
    if (body.documentos !== undefined) data.documentos = body.documentos;
    if (body.imagenes !== undefined) data.imagenes = body.imagenes;
    if (body.estado !== undefined) data.estado = body.estado;

    const updated = await prisma.gessStand.update({
      where: { id: body.id },
      data: data as never,
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

    if (!eventoId) {
      return NextResponse.json({ error: "eventoId es requerido" }, { status: 400 });
    }

    const { page, perPage, skip, take } = parsePagination({
      page: Number(searchParams.get("page") || 1),
      perPage: Number(searchParams.get("per_page") || 10),
      search: searchParams.get("search") ?? "",
      searchFields: ["standCode", "tipoStand", "estado", "empresa", "bloqueId"],
    });

    const where: Record<string, unknown> = { eventoId };

    const estadoFilter = searchParams.get("estado");
    if (estadoFilter) {
      where.estado = estadoFilter;
    }

    const searchOr = buildSearchFilter(
      searchParams.get("search") ?? "",
      ["standCode", "tipoStand", "estado", "empresa", "bloqueId"],
    );
    if (searchOr) where.OR = searchOr;

    const [stands, total] = await Promise.all([
      prisma.gessStand.findMany({
        where: where as never,
        orderBy: { standCode: "asc" },
        skip,
        take,
      }),
      prisma.gessStand.count({ where: where as never }),
    ]);

    return NextResponse.json(paginatedResponse(stands as unknown as GessStand[], total, page, perPage));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
