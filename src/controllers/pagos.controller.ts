import { NextResponse } from "next/server";
import { success, error } from "@/lib/server/api-response";
import { services } from "@/lib/server/services";
import { API_ERROR_CODES, PERMISSIONS, VER_COMO } from "@/lib/shared/constants";
import { getSession } from "@/lib/server/auth";
import { requestMetadata } from "@/lib/server/request-metadata";
import { auditarVerComo } from "@/lib/server/ver-como-audit";
import { exigirLimiteVerComo } from "@/lib/server/ver-como-rate-limit";
import { facturacionRepo } from "@/infrastructure/persistence/facturacion-repository";
import { PagosApplicationService } from "@/application/pagos/pagos-service";
import type { ClienteIdent } from "@/domain/ports/facturacion-repository";
import type { ReservaIimpArchivoInput } from "@/domain/ports/reserva-iimp-client";
import { verComoEmpresaIdSchema } from "@/validators/ver-como.validator";

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
    /* "Ver como": solo un admin puede consultar los pagos de otra empresa. */
    const empresaIdSolicitada = searchParams.get("empresaId")?.trim() || undefined;
    if (empresaIdSolicitada && !session.permissions.includes(PERMISSIONS.ADMIN_FULL)) {
      return error(API_ERROR_CODES.FORBIDDEN, "Ver como requiere permisos de administrador", 403);
    }
    const empresaIdRaw = session.permissions.includes(PERMISSIONS.ADMIN_FULL)
      ? empresaIdSolicitada
      : undefined;
    const empresaIdParsed = verComoEmpresaIdSchema.safeParse(empresaIdRaw);
    if (empresaIdRaw && !empresaIdParsed.success) {
      return error(API_ERROR_CODES.VALIDATION, "empresaId invalido", 400);
    }
    const empresaId = empresaIdParsed.success ? empresaIdParsed.data : undefined;
    if (empresaId) {
      const requestMeta = requestMetadata(request);
      exigirLimiteVerComo(
        session.sub,
        requestMeta.ip,
        VER_COMO.ACCION_VER_PAGOS,
        VER_COMO.LIMITE_ACCESOS,
      );
      const empresa = await services.empresas.obtener(empresaId);
      await auditarVerComo(
        request,
        session,
        VER_COMO.ACCION_VER_PAGOS,
        `Consultó los pagos de ${empresa.razonSocial} (${empresa.ruc}) en Ver como.`,
        {
          empresaId: empresa.id,
          ruc: empresa.ruc,
          razonSocial: empresa.razonSocial,
          page,
          perPage,
        },
      );
    }
    /* Sin filtro por evento activo: el cliente ve todos sus planes (el admin ve todos los eventos). */
    const response = success(await service.listar(ident(session), { page, perPage, empresaId }));
    if (empresaId) response.headers.set("Cache-Control", "no-store");
    return response;
  },

  /** Descarga proxy del comprobante fiscal de una cuota propia. */
  async factura(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const cuotaId = new URL(request.url).searchParams.get("cuotaId");
    if (!cuotaId) return error(API_ERROR_CODES.VALIDATION, "cuotaId requerido", 400);

    const factura = await service.factura(cuotaId, ident(session));
    let destino: URL;
    try {
      destino = new URL(factura.url, process.env.APP_URL ?? request.url);
    } catch {
      return error(API_ERROR_CODES.INTERNAL, "URL de factura invalida", 500);
    }
    if (destino.protocol !== "http:" && destino.protocol !== "https:") {
      return error(API_ERROR_CODES.INTERNAL, "URL de factura invalida", 500);
    }

    let upstream: Response;
    try {
      upstream = await fetch(destino, { cache: "no-store", redirect: "follow" });
    } catch {
      return error(API_ERROR_CODES.BAD_GATEWAY, "No se pudo obtener la factura", 502);
    }
    if (!upstream.ok) {
      return error(API_ERROR_CODES.NOT_FOUND, "La factura aun no esta publicada", 404);
    }

    /* Solo se entrega un PDF real del repositorio (no se reenvia contenido inesperado). */
    let contenido: ArrayBuffer;
    try {
      contenido = await upstream.arrayBuffer();
    } catch {
      return error(API_ERROR_CODES.BAD_GATEWAY, "No se pudo leer la factura", 502);
    }
    const firma = new Uint8Array(contenido.slice(0, 5));
    const esPdf = firma.length === 5 && firma[0] === 0x25 && firma[1] === 0x50 && firma[2] === 0x44 && firma[3] === 0x46 && firma[4] === 0x2d;
    if (!esPdf) {
      return error(API_ERROR_CODES.BAD_GATEWAY, "El repositorio no devolvio un PDF valido", 502);
    }

    /* `inline=1` abre el PDF en el navegador (preview); por defecto se descarga. */
    const disposicion = new URL(request.url).searchParams.get("inline") === "1" ? "inline" : "attachment";
    const nombre = factura.nombre.replace(/[^\w.-]+/g, "_");
    const headers = new Headers({
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposicion}; filename="${nombre}"`,
      "Content-Length": String(contenido.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    return new NextResponse(contenido, { status: 200, headers });
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

  /** "Solicitar factura" del cliente: registra la reserva en el IIMP con sus documentos (el IIMP factura cada cuota en su fecha). */
  async solicitarFactura(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const { cuotaId, archivos } = (await request.json()) as { cuotaId: string; archivos?: unknown };
    if (!cuotaId) return error(API_ERROR_CODES.VALIDATION, "cuotaId requerido", 400);
    const lista = Array.isArray(archivos) ? (archivos as ReservaIimpArchivoInput[]) : [];
    return success(await services.solicitarFactura.solicitar(cuotaId, ident(session), lista));
  },

  /** Archivos (links) de la cuenta corriente del IIMP de una cuota propia del cliente. */
  async listarArchivos(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const cuotaId = new URL(request.url).searchParams.get("cuotaId");
    if (!cuotaId) return error(API_ERROR_CODES.VALIDATION, "cuotaId requerido", 400);
    return success(await services.archivosCuenta.listar(cuotaId, ident(session)));
  },

  async agregarArchivo(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const { cuotaId, tipo, cuota, link, nombre } = (await request.json()) as {
      cuotaId: string;
      tipo: string;
      cuota?: number | null;
      link: string;
      nombre?: string | null;
    };
    if (!cuotaId || !tipo || !link) return error(API_ERROR_CODES.VALIDATION, "cuotaId, tipo y link requeridos", 400);
    return success(await services.archivosCuenta.agregar(cuotaId, { tipo, cuota: cuota ?? null, link, nombre: nombre ?? null }, ident(session)));
  },

  async eliminarArchivo(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const { cuotaId, item } = (await request.json()) as { cuotaId: string; item: number };
    if (!cuotaId || !item) return error(API_ERROR_CODES.VALIDATION, "cuotaId e item requeridos", 400);
    return success(await services.archivosCuenta.eliminar(cuotaId, item, ident(session)));
  },
};
