import { NextResponse } from "next/server";
import { getStorage } from "@/lib/server/storage";
import { ok, err } from "@/lib/server/api-response";
import { API_ERROR_CODES, UPLOAD_ALLOWED_EXTENSIONS, UPLOAD_MAX_BYTES } from "@/lib/shared/constants";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import { apiErrorLogger } from "@/lib/server/api-error-logger";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      const message = "Archivo requerido";
      apiErrorLogger.registrar({ request, status: 400, code: API_ERROR_CODES.VALIDATION, message });
      return NextResponse.json(err(API_ERROR_CODES.VALIDATION, message), { status: 400 });
    }

    /* Validacion backend (no confiar solo en el frontend): extension admitida y tamano. */
    const ext = archivoUtils.extensionDeArchivo(file.name);
    if (!archivoUtils.extensionPermitida(file.name)) {
      const message = `Formato no permitido (.${ext || "?"}). Admitidos: ${UPLOAD_ALLOWED_EXTENSIONS.join(", ")}.`;
      apiErrorLogger.registrar({ request, status: 400, code: API_ERROR_CODES.VALIDATION, message });
      return NextResponse.json(err(API_ERROR_CODES.VALIDATION, message), { status: 400 });
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      const message = `El archivo supera el maximo de ${UPLOAD_MAX_BYTES / 1024 / 1024} MB`;
      apiErrorLogger.registrar({ request, status: 400, code: API_ERROR_CODES.VALIDATION, message });
      return NextResponse.json(err(API_ERROR_CODES.VALIDATION, message), { status: 400 });
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
    apiErrorLogger.registrar({
      request,
      status: 500,
      code: API_ERROR_CODES.INTERNAL,
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(err(API_ERROR_CODES.INTERNAL, message), { status: 500 });
  }
}
