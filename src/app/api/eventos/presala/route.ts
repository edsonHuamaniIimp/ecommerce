import { NextResponse } from "next/server";
import { services } from "@/lib/services";

export async function GET() {
  const eventosPadre = await services.eventos.listarPresala();

  const result = eventosPadre
    .filter((ep) => ep.versiones.length > 0)
    .map((ep) => ({
      id: ep.id,
      nombre: ep.nombre,
      codigo: ep.codigo,
      vertical: ep.vertical,
      versiones: ep.versiones.map((ev) => ({
        id: ev.id,
        anio: ev.anio,
        tipoEvento: ev.tipoEvento,
        codigoEvento: ev.codigoEvento,
        estado: ev.estado,
        fecha_inicio: ev.fechaInicio?.toISOString() ?? null,
        fecha_fin: ev.fechaFin?.toISOString() ?? null,
        imagen: ev.imagen,
      })),
    }));

  return NextResponse.json(result);
}
