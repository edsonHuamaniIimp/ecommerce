import { NextResponse } from "next/server";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { getSession } from "@/lib/server/auth";
import { services } from "@/lib/server/services";
import { adjuntarComprobanteFiscalSchema } from "@/validators/facturacion.validator";
import type { AdjuntarComprobanteFiscalRequestDTO } from "@/types/dto/facturacion";

const service = services.facturacion;

export const facturacionController = {
  async listar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const perPage = parseInt(searchParams.get("per_page") ?? "10");
    const eventoId = searchParams.get("eventoId") ?? undefined;
    return success(await service.listar({ page, perPage, eventoId }));
  },

  async detalle(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return error(API_ERROR_CODES.VALIDATION, "id requerido", 400);
    const row = await service.detalle(id);
    if (!row) return error(API_ERROR_CODES.NOT_FOUND, "No encontrado", 404);
    return success(row);
  },

  async agregarCuota(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const { facturacionId, monto, fechaVencimiento } = (await request.json()) as { facturacionId: string; monto: number; fechaVencimiento?: string | null };
    if (!facturacionId || !monto) return error(API_ERROR_CODES.VALIDATION, "facturacionId y monto requeridos", 400);
    await service.agregarCuota(facturacionId, monto, fechaVencimiento ?? null, session.email);
    return success({ ok: true });
  },

  async pagarCuota(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const { cuotaId, comprobante } = (await request.json()) as { cuotaId: string; comprobante?: string };
    if (!cuotaId) return error(API_ERROR_CODES.VALIDATION, "cuotaId requerido", 400);
    await service.pagarCuota(cuotaId, session.email, comprobante ?? null);
    return success({ ok: true });
  },

  /** Adjunta el comprobante fiscal (boleta/factura) de una cuota pagada y notifica al cliente. */
  async adjuntarComprobante(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    service.autorizarGestion(session.permissions);
    const parsed = adjuntarComprobanteFiscalSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    const body: AdjuntarComprobanteFiscalRequestDTO = parsed.data;
    await service.adjuntarComprobanteFiscal(
      body.cuotaId,
      { tipo: body.tipo, numero: body.numero, url: body.url },
      session.email,
    );
    return success({ ok: true });
  },

  async actualizar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const { id, ...data } = (await request.json()) as { id: string; tipo?: string; modoPago?: string };
    if (!id) return error(API_ERROR_CODES.VALIDATION, "id requerido", 400);
    await service.actualizar(id, data, session.email);
    return success({ ok: true });
  },

  async eliminar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return error(API_ERROR_CODES.VALIDATION, "id requerido", 400);
    await service.eliminar(id, session.email);
    return success({ ok: true });
  },

  async eliminarCuota(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const { cuotaId } = (await request.json()) as { cuotaId: string };
    if (!cuotaId) return error(API_ERROR_CODES.VALIDATION, "cuotaId requerido", 400);
    await service.eliminarCuota(cuotaId, session.email);
    return success({ ok: true });
  },
};
