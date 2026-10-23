import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth";
import { getStorage } from "@/lib/server/storage";
import { services } from "@/lib/server/services";
import { error, success } from "@/lib/server/api-response";
import { DomainError } from "@/domain/errors/domain-error";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { ddArchivoUtils } from "@/lib/shared/utils/debida-diligencia-archivo";
import { mapDdMatrizAdjuntoToDTO } from "@/lib/shared/mappers/dd-matriz-evaluacion";
import { ddMatrizEvaluacionAdjuntoCategoriaSchema } from "@/validators/dd-matriz-evaluacion.validator";
import { archivoUtils } from "@/lib/shared/utils/archivo";

const MIME_POR_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Carga de informe/sustento de un vinculo de la Matriz de evaluacion DD (permiso segun la categoria). */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return error(API_ERROR_CODES.VALIDATION, "No se pudo leer el formulario", 400);
  }

  const file = formData.get("file");
  const vinculoId = formData.get("vinculoId");
  const categoria = ddMatrizEvaluacionAdjuntoCategoriaSchema.safeParse(formData.get("categoria"));
  if (!(file instanceof File) || typeof vinculoId !== "string" || !vinculoId || !categoria.success) {
    return error(API_ERROR_CODES.VALIDATION, "Archivo, vínculo y categoría son obligatorios", 400);
  }

  const sesionDd = {
    email: session.email,
    roles: session.roles,
    permissions: session.permissions,
    eventoId: session.eventoId,
  };
  try {
    await services.ddMatrizEvaluacion.autorizarAdjunto(sesionDd, vinculoId, categoria.data);
  } catch (err) {
    if (err instanceof DomainError) return error(err.code, err.message, err.status);
    throw err;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const errorArchivo = ddArchivoUtils.validar(
    { nombre: file.name, size: bytes.byteLength, bytes },
    { permitirDocx: true },
  );
  if (errorArchivo) return error(API_ERROR_CODES.VALIDATION, errorArchivo, 400);

  const extension = archivoUtils.extensionDeArchivo(file.name);
  const mimeType = MIME_POR_EXTENSION[extension] ?? "application/octet-stream";

  try {
    const url = await getStorage().upload(Buffer.from(bytes), `${randomUUID()}.${extension}`, mimeType);
    const adjunto = await services.ddMatrizEvaluacion.registrarAdjunto(sesionDd, {
      vinculoId,
      categoria: categoria.data,
      nombre: file.name,
      url,
      mimeType,
      tamano: bytes.byteLength,
    });
    return success(mapDdMatrizAdjuntoToDTO(adjunto));
  } catch (err) {
    if (err instanceof DomainError) return error(err.code, err.message, err.status);
    throw err;
  }
}
