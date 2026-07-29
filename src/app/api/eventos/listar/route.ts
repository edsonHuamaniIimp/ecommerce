import { NextResponse } from "next/server";
import { services } from "@/lib/services";
import { ok, err } from "@/lib/api-response";

export async function GET() {
  const eventos = await services.eventos.listarTodas();
  return NextResponse.json(ok(eventos));
}
