import { NextResponse } from "next/server";
import { success, error } from "@/lib/server/api-response";
import { services } from "@/lib/server/services";
import { API_ERROR_CODES, PERMISSIONS } from "@/lib/shared/constants";
import { getSession } from "@/lib/server/auth";
import { facturacionRepo } from "@/infrastructure/persistence/facturacion-repository";
import { PagosApplicationService } from "@/application/pagos/pagos-service";
import type { ClienteIdent } from "@/domain/ports/facturacion-repository";

const service = new PagosApplicationService(facturacionRepo);

function ident(session: { sub: string; email: string }): ClienteIdent {
  return { userId: session.sub, email: session.email };
}

function puedeGestionar(permissions: string[]): boolean {
  return permissions.includes(PERMISSIONS.ADMIN_FULL) || permissions.includes(PERMISSIONS.PAGOS_MANAGE);
}

/** Vista de pagos del exhibidor: solo sus propias facturaciones. */
export const pagosController = {
  async listar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const perPage = parseInt(searchParams.get("per_page") ?? "10");
    /* Sin filtro por evento activo: el cliente ve todos sus planes (el admin ve todos los eventos). */
    return success(await service.listar(ident(session), { page, perPage }));
  },

  async detalle(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return error(API_ERROR_CODES.VALIDATION, "id requerido", 400);
    return success(await service.detalle(id, ident(session)));
  },

  async agregarCuota(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!puedeGestionar(session.permissions)) return error(API_ERROR_CODES.FORBIDDEN, "Sin permisos para configurar pagos", 403);
    const { facturacionId, monto, fechaVencimiento } = (await request.json()) as { facturacionId: string; monto: number; fechaVencimiento?: string | null };
    if (!facturacionId || !monto || monto <= 0) return error(API_ERROR_CODES.VALIDATION, "facturacionId y monto (> 0) requeridos", 400);
    await service.agregarCuota(facturacionId, monto, fechaVencimiento ?? null, ident(session));
    return success({ ok: true });
  },

  async actualizarCuota(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!puedeGestionar(session.permissions)) return error(API_ERROR_CODES.FORBIDDEN, "Sin permisos para configurar pagos", 403);
    const { cuotaId, monto, fechaVencimiento } = (await request.json()) as { cuotaId: string; monto?: number; fechaVencimiento?: string | null };
    if (!cuotaId) return error(API_ERROR_CODES.VALIDATION, "cuotaId requerido", 400);
    if (monto !== undefined && monto <= 0) return error(API_ERROR_CODES.VALIDATION, "monto debe ser mayor a 0", 400);
    await service.actualizarCuota(cuotaId, { monto, fechaVencimiento }, ident(session));
    return success({ ok: true });
  },

  async adjuntarVoucher(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!puedeGestionar(session.permissions)) return error(API_ERROR_CODES.FORBIDDEN, "Sin permisos para configurar pagos", 403);
    const { cuotaId, comprobante } = (await request.json()) as { cuotaId: string; comprobante: string };
    if (!cuotaId || !comprobante) return error(API_ERROR_CODES.VALIDATION, "cuotaId y comprobante requeridos", 400);
    await service.adjuntarVoucher(cuotaId, comprobante, ident(session));
    return success({ ok: true });
  },

  async eliminarCuota(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!puedeGestionar(session.permissions)) return error(API_ERROR_CODES.FORBIDDEN, "Sin permisos para configurar pagos", 403);
    const { cuotaId } = (await request.json()) as { cuotaId: string };
    if (!cuotaId) return error(API_ERROR_CODES.VALIDATION, "cuotaId requerido", 400);
    await service.eliminarCuota(cuotaId, ident(session));
    return success({ ok: true });
  },

  /** "Solicitar factura" del cliente: registra la reserva en el IIMP y emite la factura de la 1ra cuota. */
  async solicitarFactura(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const { cuotaId } = (await request.json()) as { cuotaId: string };
    if (!cuotaId) return error(API_ERROR_CODES.VALIDATION, "cuotaId requerido", 400);
    return success(await services.solicitarFactura.solicitar(cuotaId, ident(session)));
  },
};
