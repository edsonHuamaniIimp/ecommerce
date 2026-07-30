import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { GessSyncResultDTO } from "@/types/dto/models";

const API_URL = process.env.PLANOGESS_API_URL ?? "https://secure2.iimp.org:8443/KBEventosPruebas/rest/planogess";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      tipoEvento?: number;
      codigoEvento?: number;
      eventoId?: string;
      seleccionadas?: Record<string, unknown>[];
    };

    if (!body.eventoId) {
      return NextResponse.json({ error: "eventoId es requerido" }, { status: 400 });
    }

    const tipoEvento = body.tipoEvento ?? 0;
    const codigoEvento = body.codigoEvento ?? 0;

    let rows: Record<string, unknown>[];

    if (body.seleccionadas && body.seleccionadas.length > 0) {
      rows = body.seleccionadas;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ TIPEVCOD: tipoEvento, EVENCOD: codigoEvento }),
        cache: "no-store",
      });

      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";

      if (!res.ok) {
        return NextResponse.json({ error: `API externa: ${res.status}` }, { status: 502 });
      }

      const data = await res.json() as Record<string, unknown>;
      rows = Array.isArray(data) ? data : Array.isArray(data.payload) ? data.payload : [];
    }

    const standApiIds: string[] = [];
    const operaciones: Prisma.PrismaPromise<unknown>[] = [];

    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;

      const uid = String(r.uid ?? r.UID ?? r.codigo ?? r.stand ?? "");
      if (!uid) continue;

      const standApiId = uid;
      standApiIds.push(standApiId);

      const tipo = String(r.type ?? r.tipo ?? r.tipo_stand ?? "");
      const medidas = tipo
        ? tipo.startsWith("PREFERENCIAL") ? "3000.00 US$"
        : tipo.startsWith("ESTANDAR_01") ? "2000.00 US$"
        : tipo.startsWith("ESTANDAR_02") ? "2500.00 US$"
        : tipo.startsWith("ISLAS") ? "ISLA"
        : ""
        : "";

      const gessData = {
        eventoId: body.eventoId,
        standApiId,
        standCode: uid,
        tipoStand: tipo || null,
        medidas: medidas || null,
        estado: String(r.status ?? r.estado ?? "") || null,
        empresa: String(r.company ?? r.empresa ?? r.razon_social ?? "") || null,
        pabellon: String(r.x ?? r.pos_x ?? "") + "," + String(r.y ?? r.pos_y ?? ""),
        ubicacion: null,
        rawData: row as Prisma.InputJsonValue,
      };

      operaciones.push(
        prisma.gessStand.upsert({
          where: { eventoId_standApiId: { eventoId: body.eventoId, standApiId } },
          create: gessData,
          update: gessData,
        }),
      );
    }

    if (operaciones.length === 0) {
      return NextResponse.json({ creados: 0, actualizados: 0, total: 0 } satisfies GessSyncResultDTO);
    }

    const existentesAntes = await prisma.gessStand.count({
      where: { eventoId: body.eventoId, standApiId: { in: standApiIds } },
    });

    await prisma.$transaction(operaciones);

    const existentesDespues = await prisma.gessStand.count({
      where: { eventoId: body.eventoId, standApiId: { in: standApiIds } },
    });

    const creados = existentesDespues - existentesAntes;
    const actualizados = existentesAntes;

    const result: GessSyncResultDTO = { creados, actualizados, total: rows.length };
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
