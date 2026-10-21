import { NextResponse } from "next/server";
import { getStorage } from "@/lib/server/storage";
import { ok, err } from "@/lib/server/api-response";
import { UPLOAD_ALLOWED_EXTENSIONS, UPLOAD_MAX_BYTES } from "@/lib/shared/constants";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import { errorLogger } from "@/lib/server/error-logger";

function registrarErrorUpload(request: Request, status: number, code: string, message: string, stack?: string) {
  void errorLogger.log({
    message,
    stack,
    url: request.url,
    metadata: { source: "server-api", method: "POST", path: "/api/upload", status, code },
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      registrarErrorUpload(request, 400, "VALIDATION", "Archivo requerido");
      return NextResponse.json(err("VALIDATION", "Archivo requerido"), { status: 400 });
    }

    /* Validacion backend (no confiar solo en el frontend): extension admitida y tamano. */
    const ext = archivoUtils.extensionDeArchivo(file.name);
    if (!archivoUtils.extensionPermitida(file.name)) {
      const message = `Formato no permitido (.${ext || "?"}). Admitidos: ${UPLOAD_ALLOWED_EXTENSIONS.join(", ")}.`;
      registrarErrorUpload(request, 400, "VALIDATION", message);
      return NextResponse.json(err("VALIDATION", message), { status: 400 });
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      const message = `El archivo supera el maximo de ${UPLOAD_MAX_BYTES / 1024 / 1024} MB`;
      registrarErrorUpload(request, 400, "VALIDATION", message);
      return NextResponse.json(err("VALIDATION", message), { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const contentType = file.type || "application/octet-stream";

    const storage = getStorage();
    const url = await storage.upload(buffer, filename, contentType);

    return NextResponse.json(ok({ url, filename, originalName: file.name }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al subir";
    registrarErrorUpload(request, 500, "INTERNAL", message, error instanceof Error ? error.stack : undefined);
    return NextResponse.json(err("INTERNAL", message), { status: 500 });
  }
}
