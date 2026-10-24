import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { getSession } from "@/lib/server/auth";
import { requestMetadata } from "@/lib/server/request-metadata";
import { auditarVerComo } from "@/lib/server/ver-como-audit";
import { exigirLimiteVerComo } from "@/lib/server/ver-como-rate-limit";
import { API_ERROR_CODES, PERMISSIONS, VER_COMO } from "@/lib/shared/constants";
import { verComoBuscarEmpresasSchema, verComoSeleccionarEmpresaSchema } from "@/validators/ver-como.validator";
import type { EmpresaEntity } from "@/domain/models/empresa";
import type { EmpresaVerComoDTO } from "@/types/dto/ver-como/empresa-ver-como.dto";

const SIN_CACHE = { headers: { "Cache-Control": "no-store" } };

function resumenEmpresa(empresa: EmpresaEntity): EmpresaVerComoDTO {
  return {
    id: empresa.id,
    ruc: empresa.ruc,
    razonSocial: empresa.razonSocial,
    nombreComercial: empresa.nombreComercial,
    estado: empresa.estado,
  };
}

export const verComoController = {
  /** Busqueda auditada de empresas para el selector "Ver como". */
  async empresas(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!session.permissions.includes(PERMISSIONS.ADMIN_FULL)) {
      return error(API_ERROR_CODES.FORBIDDEN, "Solo un administrador puede usar Ver como", 403);
    }

    const url = new URL(request.url);
    const parsed = verComoBuscarEmpresasSchema.safeParse({
      search: url.searchParams.get("search") ?? undefined,
    });
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const search = parsed.data.search?.trim() || null;
    const requestMeta = requestMetadata(request);
    exigirLimiteVerComo(
      session.sub,
      requestMeta.ip,
      VER_COMO.ACCION_BUSCAR_EMPRESA,
      VER_COMO.LIMITE_BUSQUEDAS,
    );

    const resultado = await services.empresas.listar({
      page: 1,
      perPage: VER_COMO.MAX_RESULTADOS,
      search: search ?? undefined,
    });
    const data = resultado.data.map(resumenEmpresa);

    await auditarVerComo(
      request,
      session,
      VER_COMO.ACCION_BUSCAR_EMPRESA,
      search
        ? `Buscó empresas para Ver como con el término "${search}".`
        : "Abrió el buscador de empresas de Ver como.",
      {
        search,
        resultCount: data.length,
        total: resultado.total,
        empresaIds: data.map((empresa) => empresa.id),
      },
    );

    return success({ data, total: resultado.total }, SIN_CACHE);
  },

  /** Valida la empresa seleccionada y registra la seleccion antes de navegar. */
  async seleccionar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!session.permissions.includes(PERMISSIONS.ADMIN_FULL)) {
      return error(API_ERROR_CODES.FORBIDDEN, "Solo un administrador puede usar Ver como", 403);
    }

    const parsed = verComoSeleccionarEmpresaSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, "empresaId valido es requerido", 400);
    }

    const requestMeta = requestMetadata(request);
    exigirLimiteVerComo(
      session.sub,
      requestMeta.ip,
      VER_COMO.ACCION_SELECCIONAR_EMPRESA,
      VER_COMO.LIMITE_SELECCIONES,
    );

    /* Valida existencia antes de habilitar cualquier consulta por empresa. */
    const empresa = await services.empresas.obtener(parsed.data.empresaId);
    await auditarVerComo(
      request,
      session,
      VER_COMO.ACCION_SELECCIONAR_EMPRESA,
      `Seleccionó la empresa ${empresa.razonSocial} (${empresa.ruc}) para Ver como.`,
      {
        empresaId: empresa.id,
        ruc: empresa.ruc,
        razonSocial: empresa.razonSocial,
        estado: empresa.estado,
      },
    );

    return success(resumenEmpresa(empresa), SIN_CACHE);
  },
};
