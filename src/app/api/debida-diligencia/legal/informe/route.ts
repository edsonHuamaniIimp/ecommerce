import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth";
import { getStorage } from "@/lib/server/storage";
import { error, success } from "@/lib/server/api-response";
import { API_ERROR_CODES, PERMISSIONS, ROLES } from "@/lib/shared/constants";
import { ddArchivoUtils } from "@/lib/shared/utils/debida-diligencia-archivo";

/** Carga del informe legal (PDF) adjunto a la decision de Legal. */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  const autorizado =
    session &&
    (session.roles.includes(ROLES.ADMIN) || session.permissions.includes(PERMISSIONS.DD_LEGAL));
  if (!session || !autorizado) {
    return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return error(API_ERROR_CODES.VALIDATION, "No se pudo leer el formulario", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return error(API_ERROR_CODES.VALIDATION, "Archivo requerido", 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const errorArchivo = ddArchivoUtils.validarInformeLegal({
    nombre: file.name,
    size: bytes.byteLength,
    bytes,
  });
  if (errorArchivo) {
    return error(API_ERROR_CODES.VALIDATION, errorArchivo, 400);
  }

  const url = await getStorage().upload(
    Buffer.from(bytes),
    `${randomUUID()}.pdf`,
    "application/pdf",
  );

  return success({
    url,
    nombre: file.name,
    size: bytes.byteLength,
    mimeType: "application/pdf",
  });
}
