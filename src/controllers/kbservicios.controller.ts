import { NextResponse } from "next/server";
import { services } from "@/lib/services";
import { success } from "@/lib/api-response";

async function listarTipos(): Promise<NextResponse> {
  return success(await services.kbServicios.listarTiposEvento());
}

async function listarEventos(request: Request): Promise<NextResponse> {
  const body = await request.json() as { code?: number };
  const eventos = await services.kbServicios.listarEventos(body.code ?? 14);
  return success({ success: true, eventslist: eventos });
}

export const kbServiciosController = { listarTipos, listarEventos };
