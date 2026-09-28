import 'server-only';

import { prisma } from "@/lib/server/db";
import { ESTADOS_FACTURACION, ESTADOS_CUOTA, ESTADOS_SOLICITUD } from "@/lib/shared/constants";
import type {
  IFacturacionRepository,
  FacturacionRow,
  FacturacionListParams,
  FacturacionListResult,
  FacturacionClienteParams,
  ClienteIdent,
  CuotaUpdate,
} from "@/domain/ports/facturacion-repository";

/** Forma cruda (Prisma) de una facturacion con cuotas + solicitud. */
interface FacturacionRaw {
  id: string;
  solicitudId: string;
  tipo: string;
  estado: string;
  montoTotal: unknown;
  moneda: string;
  modoPago: string;
  createdAt: Date;
  cuotas: Array<{ id: string; numero: number; monto: unknown; fechaVencimiento: Date | null; estado: string; comprobante: string | null }>;
  solicitud: {
    email: string | null;
    gessStand: { standCode: string } | null;
    stands: Array<{ gessStand: { standCode: string } | null }>;
  };
}

const SOLICITUD_SELECT = {
  email: true,
  gessStand: { select: { standCode: true } },
  stands: { include: { gessStand: { select: { standCode: true } } } },
};

const INCLUDE = {
  cuotas: { orderBy: { numero: "asc" as const } },
  solicitud: { select: SOLICITUD_SELECT },
};

function toRow(r: FacturacionRaw): FacturacionRow {
  return {
    id: r.id,
    solicitudId: r.solicitudId,
    tipo: r.tipo,
    estado: r.estado,
    montoTotal: Number(r.montoTotal),
    moneda: r.moneda,
    modoPago: r.modoPago,
    standCode: r.solicitud.gessStand?.standCode ?? r.solicitud.stands[0]?.gessStand?.standCode ?? "—",
    correoSolicitante: r.solicitud.email,
    createdAt: r.createdAt.toISOString(),
    cuotas: r.cuotas.map((c) => ({
      id: c.id, numero: c.numero, monto: Number(c.monto),
      fechaVencimiento: c.fechaVencimiento?.toISOString() ?? null, estado: c.estado,
      comprobante: c.comprobante,
    })),
  };
}

/** OR de propiedad (userId / email) para filtrar facturaciones del cliente. */
function identOr(ident: ClienteIdent): Record<string, unknown>[] {
  const or: Record<string, unknown>[] = [];
  if (ident.userId) or.push({ userId: ident.userId });
  if (ident.email) or.push({ email: ident.email });
  // Sin identidad no se expone nada.
  return or.length > 0 ? or : [{ id: "__sin_identidad__" }];
}

export class FacturacionPrismaRepository implements IFacturacionRepository {
  async listar(params: FacturacionListParams): Promise<FacturacionListResult> {
    const where: Record<string, unknown> = { flgActivo: true };
    if (params.eventoId) {
      where.solicitud = {
        OR: [
          { gessStand: { eventoId: params.eventoId } },
          { stands: { some: { gessStand: { eventoId: params.eventoId } } } },
        ],
      };
    }
    return this.paginar(where, params);
  }

  async listarPorCliente(params: FacturacionClienteParams): Promise<FacturacionListResult> {
    // Solo solicitudes vigentes (no bajas logicas) y, si hay evento activo, de ese evento.
    const solicitudWhere: Record<string, unknown> = { flgActivo: true, OR: identOr(params) };
    if (params.eventoId) {
      solicitudWhere.AND = [
        {
          OR: [
            { gessStand: { eventoId: params.eventoId } },
            { stands: { some: { gessStand: { eventoId: params.eventoId } } } },
          ],
        },
      ];
    }
    const where: Record<string, unknown> = { flgActivo: true, solicitud: solicitudWhere };
    return this.paginar(where, params);
  }

  private async paginar(where: Record<string, unknown>, params: { page: number; perPage: number }): Promise<FacturacionListResult> {
    const [rows, total] = await Promise.all([
      prisma.facturacion.findMany({
        where: where as never,
        include: INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
      prisma.facturacion.count({ where: where as never }),
    ]);
    return { data: rows.map((r) => toRow(r as unknown as FacturacionRaw)), total };
  }

  async detalle(id: string): Promise<FacturacionRow | null> {
    const r = await prisma.facturacion.findUnique({ where: { id }, include: INCLUDE });
    return r ? toRow(r as unknown as FacturacionRaw) : null;
  }

  async agregarCuota(facturacionId: string, monto: number, fechaVencimiento: string | null, createdBy: string) {
    const last = await prisma.facturacionCuota.findFirst({ where: { facturacionId }, orderBy: { numero: "desc" } });
    const numero = (last?.numero ?? 0) + 1;
    await prisma.facturacionCuota.create({
      data: { facturacionId, numero, monto, fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null },
    });
    await prisma.facturacionHistorial.create({
      data: { facturacionId, accion: "agregar_cuota", detalle: `Cuota #${numero} agregada por ${monto.toFixed(2)}`, createdBy },
    });
  }

  async actualizarCuota(cuotaId: string, data: CuotaUpdate, createdBy: string) {
    const prev = await prisma.facturacionCuota.findUnique({ where: { id: cuotaId } });
    if (!prev) return;
    const updateData: Record<string, unknown> = {};
    if (data.monto !== undefined) updateData.monto = data.monto;
    if (data.fechaVencimiento !== undefined) {
      updateData.fechaVencimiento = data.fechaVencimiento ? new Date(data.fechaVencimiento) : null;
    }
    await prisma.facturacionCuota.update({ where: { id: cuotaId }, data: updateData });
    await prisma.facturacionHistorial.create({
      data: { facturacionId: prev.facturacionId, accion: "actualizar_cuota", detalle: `Cuota #${prev.numero} actualizada`, createdBy },
    });
  }

  async adjuntarVoucher(cuotaId: string, comprobante: string, createdBy: string) {
    const prev = await prisma.facturacionCuota.findUnique({ where: { id: cuotaId }, select: { facturacionId: true, numero: true } });
    if (!prev) return;
    await prisma.facturacionCuota.update({ where: { id: cuotaId }, data: { comprobante } });
    await prisma.facturacionHistorial.create({
      data: { facturacionId: prev.facturacionId, accion: "adjuntar_voucher", detalle: `Voucher adjuntado a la cuota #${prev.numero}`, createdBy },
    });
  }

  async pagarCuota(cuotaId: string, createdBy: string, comprobante: string | null) {
    const cuota = await prisma.facturacionCuota.update({
      where: { id: cuotaId },
      data: { estado: ESTADOS_CUOTA.PAGADO, comprobante },
    });
    await prisma.facturacionHistorial.create({
      data: { facturacionId: cuota.facturacionId, accion: "pagar_cuota", detalle: `Cuota #${cuota.numero} marcada como pagada`, createdBy },
    });
    const pendientes = await prisma.facturacionCuota.count({
      where: { facturacionId: cuota.facturacionId, estado: ESTADOS_CUOTA.PENDIENTE },
    });
    if (pendientes === 0) {
      await prisma.facturacion.update({ where: { id: cuota.facturacionId }, data: { estado: ESTADOS_FACTURACION.PAGADO } });
      const facturacion = await prisma.facturacion.findUnique({ where: { id: cuota.facturacionId }, select: { solicitudId: true } });
      if (facturacion) {
        await prisma.solicitud.update({ where: { id: facturacion.solicitudId }, data: { estado: ESTADOS_SOLICITUD.PAGADO } });
      }
      await prisma.facturacionHistorial.create({
        data: { facturacionId: cuota.facturacionId, accion: "actualizar", detalle: `Facturacion marcada como pagada (todas las cuotas pagadas)`, createdBy },
      });
    }
  }

  async actualizar(id: string, data: { tipo?: string }, createdBy: string) {
    const prev = await prisma.facturacion.findUnique({ where: { id }, select: { tipo: true } });
    await prisma.facturacion.update({ where: { id }, data });
    if (data.tipo && prev?.tipo !== data.tipo) {
      await prisma.facturacionHistorial.create({
        data: { facturacionId: id, accion: "actualizar", detalle: `Tipo de pago cambiado de "${prev?.tipo}" a "${data.tipo}"`, createdBy },
      });
    }
  }

  async eliminar(id: string, createdBy: string) {
    await prisma.facturacion.update({ where: { id }, data: { flgActivo: false } });
    await prisma.facturacionHistorial.create({
      data: { facturacionId: id, accion: "eliminar", detalle: "Registro dado de baja", createdBy },
    });
  }

  async eliminarCuota(cuotaId: string, createdBy: string) {
    const cuota = await prisma.facturacionCuota.findUnique({ where: { id: cuotaId }, select: { facturacionId: true, numero: true } });
    if (!cuota) return;
    await prisma.facturacionCuota.delete({ where: { id: cuotaId } });
    await prisma.facturacionHistorial.create({
      data: { facturacionId: cuota.facturacionId, accion: "eliminar_cuota", detalle: `Cuota #${cuota.numero} eliminada`, createdBy },
    });
    // Renumera secuencialmente (1..n) las cuotas restantes.
    const restantes = await prisma.facturacionCuota.findMany({
      where: { facturacionId: cuota.facturacionId },
      orderBy: { numero: "asc" },
      select: { id: true, numero: true },
    });
    await Promise.all(
      restantes.map((c, i) => (c.numero === i + 1 ? null : prisma.facturacionCuota.update({ where: { id: c.id }, data: { numero: i + 1 } }))),
    );
  }

  async esPropietario(facturacionId: string, ident: ClienteIdent): Promise<boolean> {
    const f = await prisma.facturacion.findUnique({
      where: { id: facturacionId },
      select: { solicitud: { select: { flgActivo: true, userId: true, email: true } } },
    });
    // Solo solicitudes vigentes (no bajas logicas).
    if (!f || !f.solicitud.flgActivo) return false;
    return this.coincide(f.solicitud, ident);
  }

  async esPropietarioDeCuota(cuotaId: string, ident: ClienteIdent): Promise<boolean> {
    const c = await prisma.facturacionCuota.findUnique({ where: { id: cuotaId }, select: { facturacionId: true } });
    if (!c) return false;
    return this.esPropietario(c.facturacionId, ident);
  }

  async facturacionDeCuota(cuotaId: string): Promise<FacturacionRow | null> {
    const c = await prisma.facturacionCuota.findUnique({ where: { id: cuotaId }, select: { facturacionId: true } });
    if (!c) return null;
    return this.detalle(c.facturacionId);
  }

  private coincide(solicitud: { userId: string | null; email: string | null }, ident: ClienteIdent): boolean {
    const porUser = Boolean(ident.userId) && solicitud.userId === ident.userId;
    const porEmail = Boolean(ident.email) && solicitud.email === ident.email;
    return porUser || porEmail;
  }
}

export const facturacionRepo = new FacturacionPrismaRepository();
