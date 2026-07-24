import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const now = new Date();

  const eventosPadre = await prisma.eventoPadre.findMany({
    include: {
      eventos: {
        where: {
          estado: "active",
          flgActivo: true,
          OR: [
            { fechaInicio: null },
            { fechaFin: null },
            { fechaInicio: { lte: now }, fechaFin: { gte: now } },
          ],
        },
        orderBy: { anio: "asc" },
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
        flgActivo: ev.flgActivo,
      })),
    }));

  return NextResponse.json(result);
}
