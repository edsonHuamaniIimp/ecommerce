import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const eventosPadre = await prisma.eventoPadre.findMany({
    include: {
      eventos: {
        where: { estado: { in: ["active", "draft"] } },
        orderBy: { anio: "desc" },
      },
    },
    orderBy: { nombre: "asc" },
  });

  const result = eventosPadre
    .filter((ep) => ep.eventos.length > 0)
    .map((ep) => ({
      id: ep.id,
      nombre: ep.nombre,
      codigo: ep.codigo,
      vertical: ep.vertical,
      versiones: ep.eventos.map((ev) => ({
        id: ev.id,
        anio: ev.anio,
        tipoEvento: ev.tipoEvento,
        codigoEvento: ev.codigoEvento,
        estado: ev.estado,
        fechaInicio: ev.fechaInicio?.toISOString() ?? null,
        fechaFin: ev.fechaFin?.toISOString() ?? null,
        imagen: ev.imagen,
      })),
    }));

  return NextResponse.json(result);
}
