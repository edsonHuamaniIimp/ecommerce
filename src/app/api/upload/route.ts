import { NextResponse } from "next/server";
import { getStorage } from "@/lib/server/storage";
import { ok, err } from "@/lib/server/api-response";
import { UPLOAD_ALLOWED_EXTENSIONS, UPLOAD_MAX_BYTES } from "@/lib/shared/constants";
import { archivoUtils } from "@/lib/shared/utils/archivo";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(err("VALIDATION", "Archivo requerido"), { status: 400 });
    }

    /* Validacion backend (no confiar solo en el frontend): extension admitida y tamano. */
    const ext = archivoUtils.extensionDeArchivo(file.name);
    if (!archivoUtils.extensionPermitida(file.name)) {
      return NextResponse.json(
        err("VALIDATION", `Formato no permitido (.${ext || "?"}). Admitidos: ${UPLOAD_ALLOWED_EXTENSIONS.join(", ")}.`),
        { status: 400 },
      );
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        err("VALIDATION", `El archivo supera el maximo de ${UPLOAD_MAX_BYTES / 1024 / 1024} MB`),
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const contentType = file.type || "application/octet-stream";

    const storage = getStorage();
    const url = await storage.upload(buffer, filename, contentType);

    return NextResponse.json(ok({ url, filename, originalName: file.name }));
  } catch (error) {
    return NextResponse.json(
      err("INTERNAL", error instanceof Error ? error.message : "Error al subir"),
      { status: 500 },
    );
  }
}
