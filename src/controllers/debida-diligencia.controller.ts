import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { DomainError } from "@/domain/errors/domain-error";
import { getSession } from "@/lib/server/auth";
import {
  mapDdBandejaToDTO,
  mapDdClientesToDTO,
  mapDdEmpresaToDTO,
  mapDdEmpresasToDTO,
  mapDdEstadoExternoToDTO,
  mapDdExpedienteToDTO,
  mapDdMatrizToDTO,
  mapDdPanelToDTO,
  mapDdReputacionToDTO,
} from "@/lib/shared/mappers/debida-diligencia";
import {
  ddClientesQuerySchema,
  ddEmpresasQuerySchema,
  ddGuardarSchema,
  ddLegalResolverSchema,
  ddMatrizQuerySchema,
  ddPaginacionSchema,
  ddReputacionResolverSchema,
  ddRevisarSchema,
} from "@/validators/debida-diligencia.validator";
import type { DdMiExpedienteDTO } from "@/types/dto/debida-diligencia";
import type { DdSession } from "@/application/debida-diligencia/debida-diligencia-service";

async function sesionRequerida(): Promise<DdSession> {
  const session = await getSession();
  if (!session) throw new DomainError("No autorizado", API_ERROR_CODES.UNAUTHORIZED, 401);
  return {
    email: session.email,
    roles: session.roles,
    permissions: session.permissions,
    eventoId: session.eventoId,
  };
}

export const debidaDiligenciaController = {
  /** Expediente de la empresa del usuario autenticado. */
  async miExpediente(): Promise<NextResponse> {
    const session = await sesionRequerida();
    const resultado = await services.debidaDiligencia.obtenerMiExpediente(session);
    const data: DdMiExpedienteDTO = {
      expediente: resultado.expediente ? mapDdExpedienteToDTO(resultado.expediente) : null,
      empresa: resultado.empresa ? mapDdEmpresaToDTO(resultado.empresa) : null,
      estadoExterno: mapDdEstadoExternoToDTO(resultado.estadoExterno),
    };
    return success(data);
  },

  /** Guarda el wizard (borrador o correccion). */
  async guardar(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const parsed = ddGuardarSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    const expediente = await services.debidaDiligencia.guardar(parsed.data, session);
    return success(mapDdExpedienteToDTO(expediente));
  },

  /** Envia el expediente a revision de Logistica. */
  async enviar(): Promise<NextResponse> {
    const session = await sesionRequerida();
    const expediente = await services.debidaDiligencia.enviar(session);
    return success(mapDdExpedienteToDTO(expediente));
  },

  /** Bandeja paginada de Logistica. */
  async bandeja(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const params = new URL(request.url).searchParams;
    const parsed = ddPaginacionSchema.safeParse({
      page: params.get("page") ?? undefined,
      perPage: params.get("perPage") ?? undefined,
      search: params.get("search") ?? undefined,
      estado: params.get("estado") ?? undefined,
      origen: params.get("origen") ?? undefined,
      vinculo: params.get("vinculo") ?? undefined,
      documentos: params.get("documentos") ?? undefined,
      reputacion: params.get("reputacion") ?? undefined,
      asignacion: params.get("asignacion") ?? undefined,
      solicitudes: params.get("solicitudes") ?? undefined,
      orden: params.get("orden") ?? undefined,
    });
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    const resultado = await services.debidaDiligencia.bandeja(parsed.data, session);
    return success(mapDdBandejaToDTO(resultado));
  },

  /** Bandeja de expedientes derivados a Legal. */
  async bandejaLegal(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const params = new URL(request.url).searchParams;
    const parsed = ddPaginacionSchema.safeParse({
      page: params.get("page") ?? undefined,
      perPage: params.get("perPage") ?? undefined,
      search: params.get("search") ?? undefined,
      estado: params.get("estado") ?? undefined,
    });
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    const resultado = await services.debidaDiligencia.bandejaLegal(parsed.data, session);
    return success(mapDdBandejaToDTO(resultado));
  },

  /** Decision final de Legal con informe adjunto. */
  async resolverLegal(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const parsed = ddLegalResolverSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    const expediente = await services.debidaDiligencia.resolverLegal(parsed.data, session);
    return success(mapDdExpedienteToDTO(expediente));
  },

  /** Empresas con su estado consolidado de DD. */
  async empresas(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const params = new URL(request.url).searchParams;
    const parsed = ddEmpresasQuerySchema.safeParse({
      page: params.get("page") ?? undefined,
      perPage: params.get("perPage") ?? undefined,
      search: params.get("search") ?? undefined,
      documento: params.get("documento") ?? undefined,
      resultado: params.get("resultado") ?? undefined,
      estadoEvaluacion: params.get("estadoEvaluacion") ?? undefined,
      evento: params.get("evento") ?? undefined,
    });
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    const resultado = await services.debidaDiligencia.empresas(parsed.data, session);
    return success(mapDdEmpresasToDTO(resultado));
  },

  /** Clientes con evaluacion DD, resultados y vigencia. */
  async clientes(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const params = new URL(request.url).searchParams;
    const parsed = ddClientesQuerySchema.safeParse({
      page: params.get("page") ?? undefined,
      perPage: params.get("perPage") ?? undefined,
      search: params.get("search") ?? undefined,
      ruc: params.get("ruc") ?? undefined,
      estado: params.get("estado") ?? undefined,
      resultado: params.get("resultado") ?? undefined,
      estadoEvaluacion: params.get("estadoEvaluacion") ?? undefined,
    });
    if (!parsed.success) {
      return error(
        API_ERROR_CODES.VALIDATION,
        parsed.error.issues.map((i) => i.message).join("; "),
        400,
      );
    }
    const resultado = await services.debidaDiligencia.clientes(parsed.data, session);
    return success(mapDdClientesToDTO(resultado));
  },

  /** Detalle de un expediente. */
  async detalle(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return error(API_ERROR_CODES.VALIDATION, "id requerido", 400);
    const expediente = await services.debidaDiligencia.detalle(id, session);
    return success(mapDdExpedienteToDTO(expediente));
  },

  /** Resolucion de Logistica. */
  async revisar(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const parsed = ddRevisarSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    const expediente = await services.debidaDiligencia.revisar(parsed.data, session);
    return success(mapDdExpedienteToDTO(expediente));
  },

  /** Panel del modulo: KPIs, vigencias y matriz. */
  async panel(): Promise<NextResponse> {
    const session = await sesionRequerida();
    const panel = await services.debidaDiligencia.panel(session);
    return success(mapDdPanelToDTO(panel));
  },

  /** Matriz paginada de empresas del panel. */
  async matriz(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const params = new URL(request.url).searchParams;
    const parsed = ddMatrizQuerySchema.safeParse({
      page: params.get("page") ?? undefined,
      perPage: params.get("perPage") ?? undefined,
      search: params.get("search") ?? undefined,
      estado: params.get("estado") ?? undefined,
      vinculo: params.get("vinculo") ?? undefined,
    });
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    const resultado = await services.debidaDiligencia.matriz(parsed.data, session);
    return success(mapDdMatrizToDTO(resultado));
  },

  /** Bandeja de revision reputacional. */
  async reputacionListar(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const params = new URL(request.url).searchParams;
    const parsed = ddPaginacionSchema.safeParse({
      page: params.get("page") ?? undefined,
      perPage: params.get("perPage") ?? undefined,
      search: params.get("search") ?? undefined,
      estado: params.get("estado") ?? undefined,
    });
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    const resultado = await services.debidaDiligencia.reputacionListar(parsed.data, session);
    return success(mapDdReputacionToDTO(resultado));
  },

  /** Resolucion de un caso reputacional. */
  async reputacionResolver(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    const parsed = ddReputacionResolverSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    await services.debidaDiligencia.reputacionResolver(parsed.data, session);
    return success({ ok: true });
  },
};
