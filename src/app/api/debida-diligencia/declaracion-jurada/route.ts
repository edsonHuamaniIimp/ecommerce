import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth";
import { PERMISSIONS, ROLES } from "@/lib/shared/constants";

const ARCHIVO = "declaracion-jurada-compromiso-actualizacion.docx";

/** Descarga el formato oficial de la declaracion jurada de actualizacion. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  const puedeDescargar =
    session &&
    (session.roles.includes(ROLES.ADMIN) || session.permissions.includes(PERMISSIONS.DD_FORMULARIO));
  if (!puedeDescargar) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const archivo = await readFile(path.join(process.cwd(), "plantillas", ARCHIVO));
    return new NextResponse(new Uint8Array(archivo), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${ARCHIVO}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se encontro el formato de declaracion jurada" }, { status: 500 });
  }
}
