import "server-only";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth";
import { services } from "@/lib/server/services";
import { error, success } from "@/lib/server/api-response";
import {
  API_ERROR_CODES,
  DD_DOCUMENTO_MAX_BYTES,
  PERMISSIONS,
  ROLES,
} from "@/lib/shared/constants";
import { parseEmpresasExcel } from "@/lib/server/dd-empresa-excel";

/** Importacion masiva de la lista oficial de DD (XLSX o CSV). */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  const autorizado =
    session &&
    (session.roles.includes(ROLES.ADMIN) ||
      session.permissions.includes(PERMISSIONS.DD_VER));
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
  if (file.size > DD_DOCUMENTO_MAX_BYTES) {
    return error(
      API_ERROR_CODES.VALIDATION,
      `El archivo supera el máximo de ${DD_DOCUMENTO_MAX_BYTES / 1024 / 1024} MB.`,
      400,
    );
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (extension !== "xlsx" && extension !== "csv") {
    return error(API_ERROR_CODES.VALIDATION, "Use un archivo XLSX o CSV.", 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseEmpresasExcel(buffer, file.name);
    if (parsed.rows.length === 0) {
      return error(
        API_ERROR_CODES.VALIDATION,
        "No se encontraron filas válidas para importar.",
        400,
      );
    }
    const resultado = await services.debidaDiligencia.importarEmpresas(
      parsed.rows.map((row) => ({
        documento: row.documento,
        razonSocial: row.razonSocial,
        tipoDocumento: row.tipoDocumento,
        motivoEvaluacion: row.motivoEvaluacion,
        eventoProyecto: row.eventoProyecto,
        resultado: row.resultado,
        estadoOrigen: row.estadoOrigen,
        fechaIngreso: row.fechaIngreso,
        fechaRevision: row.fechaRevision,
        fechaVencimiento: row.fechaVencimiento,
      })),
      {
        email: session.email,
        roles: session.roles,
        permissions: session.permissions,
        eventoId: session.eventoId,
      },
    );
    return success({
      ...resultado,
      omitidos: parsed.omitidos,
      errores: parsed.errors,
    });
  } catch (e) {
    return error(
      API_ERROR_CODES.VALIDATION,
      e instanceof Error ? e.message : "No se pudo importar el archivo",
      400,
    );
  }
}
