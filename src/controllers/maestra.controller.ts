import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";

async function listar(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const tabla = searchParams.get("tabla");
  if (!tabla) return error(API_ERROR_CODES.VALIDATION, "tabla requerido", 400);

  const padre = await prisma.maestra.findFirst({
    where: { tabla, nidMaestraPadre: 0, activo: true },
    select: { id: true },
  });
  if (!padre) return success([]);

  const hijos = await prisma.maestra.findMany({
    where: { nidMaestraPadre: padre.id, activo: true },
    orderBy: { numOrden: "asc" },
    select: { id: true, itemId: true, nombre: true, descripcion: true },
  });
  return success(hijos);
}

export const maestraController = { listar };
