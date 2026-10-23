import "server-only";

import { createHash } from "node:crypto";
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
import type { DdEventoImportacionCatalogo } from "@/domain/models/debida-diligencia";

/** Importacion masiva de la lista oficial de DD (XLSX, CSV o TXT). */
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
  if (extension !== "xlsx" && extension !== "csv" && extension !== "txt") {
    return error(API_ERROR_CODES.VALIDATION, "Use un archivo XLSX, CSV o TXT.", 400);
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
    let empresasCreadas = 0;
    let empresasExistentes = 0;
    const empresasError: { documento: string; mensaje: string }[] = [];
    const puedeCrearEmpresas =
      session.roles.includes(ROLES.ADMIN) ||
      session.permissions.includes(PERMISSIONS.EMPRESAS_MANAGE);

    if (puedeCrearEmpresas) {
      for (const row of parsed.rows) {
        try {
          const { empresa, creada } = await services.empresas.crearSiNoExiste(
            {
              ruc: row.documento,
              tipoDocumento: row.tipoDocumento,
              razonSocial: row.razonSocial,
            },
            session.email,
          );
          row.empresaId = empresa.id;
          if (creada) empresasCreadas += 1;
          else empresasExistentes += 1;
        } catch (e) {
          empresasError.push({
            documento: row.documento,
            mensaje: e instanceof Error ? e.message : "No se pudo crear la empresa",
          });
        }
      }
    }

    const filasConEmpresa = parsed.rows.filter((row) => row.empresaId);
    const eventoDestinoId = String(formData.get("eventoId") ?? "").trim() || undefined;
    /* El catalogo aporta tipo, codigo y fechas de cada version de evento. */
    let catalogoEventos: DdEventoImportacionCatalogo[] = [];
    try {
      const vistos = new Set<string>();
      for (const padre of await services.presala.listarTodas()) {
        for (const version of padre.versiones) {
          if (version.tipoEvento === undefined || version.codigoEvento === undefined) continue;
          const clave = `${version.tipoEvento}:${version.codigoEvento}`;
          if (vistos.has(clave)) continue;
          vistos.add(clave);
          const inicio = version.fecha_inicio ? new Date(version.fecha_inicio) : null;
          const fin = version.fecha_fin ? new Date(version.fecha_fin) : null;
          catalogoEventos.push({
            tipoEvento: version.tipoEvento,
            codigoEvento: version.codigoEvento,
            anio: version.anio,
            nombre: padre.nombre,
            fechaInicio: inicio && !Number.isNaN(inicio.getTime()) ? inicio : null,
            fechaFin: fin && !Number.isNaN(fin.getTime()) ? fin : null,
          });
        }
      }
    } catch {
      catalogoEventos = [];
    }

    const resultado = await services.debidaDiligencia.importarExpedientes(
      filasConEmpresa.map((row) => ({
        empresaId: row.empresaId as string,
        documento: row.documento,
        razonSocial: row.razonSocial,
        motivoEvaluacion: row.motivoEvaluacion,
        eventoProyecto: row.eventoProyecto,
        resultado: row.resultado,
        estadoOrigen: row.estadoOrigen,
        fechaIngreso: row.fechaIngreso,
        fechaRevision: row.fechaRevision,
        fechaVencimiento: row.fechaVencimiento,
      })),
      {
        archivo: file.name,
        hash: createHash("sha256").update(buffer).digest("hex"),
        total: parsed.rows.length,
        omitidos: parsed.omitidos,
        errores: [...parsed.errors, ...empresasError],
      },
      {
        email: session.email,
        roles: session.roles,
        permissions: session.permissions,
        eventoId: session.eventoId,
      },
      eventoDestinoId,
      catalogoEventos,
    );
    return success({
      ...resultado,
      empresasCreadas,
      empresasExistentes,
      empresasError,
      omitidos: parsed.omitidos + empresasError.length + resultado.omitidos,
      errores: [...parsed.errors, ...empresasError],
    });
  } catch (e) {
    return error(
      API_ERROR_CODES.VALIDATION,
      e instanceof Error ? e.message : "No se pudo importar el archivo",
      400,
    );
  }
}
