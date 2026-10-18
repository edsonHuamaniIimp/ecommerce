import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth";
import { getStorage } from "@/lib/server/storage";
import { error, success } from "@/lib/server/api-response";
import {
  API_ERROR_CODES,
  DD_DOCUMENTOS_REQUERIDOS,
  PERMISSIONS,
  ROLES,
  type DdDocumentoTipo,
} from "@/lib/shared/constants";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import { ddArchivoUtils } from "@/lib/shared/utils/debida-diligencia-archivo";

const MIME_POR_FORMATO = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
} as const;

/** Carga de un documento de sustento del modulo DD (validacion real en backend). */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  const autorizado =
    session &&
    (session.roles.includes(ROLES.ADMIN) || session.permissions.includes(PERMISSIONS.DD_FORMULARIO));
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
  const tipo = formData.get("tipo");
  if (!(file instanceof File)) {
    return error(API_ERROR_CODES.VALIDATION, "Archivo requerido", 400);
  }
  if (typeof tipo !== "string" || !DD_DOCUMENTOS_REQUERIDOS.some((d) => d.tipo === tipo)) {
    return error(API_ERROR_CODES.VALIDATION, "Tipo de documento inválido", 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const errorArchivo = ddArchivoUtils.validar({
    nombre: file.name,
    size: bytes.byteLength,
    bytes,
  });
  if (errorArchivo) {
    return error(API_ERROR_CODES.VALIDATION, errorArchivo, 400);
  }

  const formato = ddArchivoUtils.detectarFormato(bytes);
  const extension = archivoUtils.extensionDeArchivo(file.name);
  const filename = `${randomUUID()}.${extension}`;
  const mimeType = formato ? MIME_POR_FORMATO[formato] : file.type || "application/octet-stream";
  const url = await getStorage().upload(Buffer.from(bytes), filename, mimeType);

  return success({
    url,
    nombre: file.name,
    tipo: tipo as DdDocumentoTipo,
    size: bytes.byteLength,
    mimeType,
  });
}
