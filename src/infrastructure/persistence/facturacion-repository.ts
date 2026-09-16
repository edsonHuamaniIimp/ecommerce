import 'server-only';

import { prisma } from "@/lib/server/db";
import { ESTADOS_FACTURACION, ESTADOS_CUOTA, ESTADOS_SOLICITUD } from "@/lib/shared/constants";
import type { IFacturacionRepository, FacturacionRow, FacturacionListParams, FacturacionListResult } from "@/domain/ports/facturacion-repository";

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
    const [rows, total] = await Promise.all([
      prisma.facturacion.findMany({
        where: where as never,
        include: {
          cuotas: { orderBy: { numero: "asc" } },
          solicitud: {
            select: {
              email: true,
            gessStand: { select: { standCode: true } },
              stands: { include: { gessStand: { select: { standCode: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
      prisma.facturacion.count({ where: where as never }),
    ]);

    return {
      data: rows.map(r => ({
        id: r.id,
        solicitudId: r.solicitudId,
        tipo: r.tipo,
        estado: r.estado,
        montoTotal: Number(r.montoTotal),
        moneda: r.moneda,
        modoPago: (r as unknown as Record<string, unknown>).modoPago as string ?? "cuotas",
        standCode: r.solicitud.gessStand?.standCode ?? r.solicitud.stands[0]?.gessStand?.standCode ?? "—",
        correoSolicitante: r.solicitud.email,
        createdAt: r.createdAt.toISOString(),
        cuotas: r.cuotas.map(c => ({
          id: c.id, numero: c.numero, monto: Number(c.monto),
          fechaVencimiento: c.fechaVencimiento?.toISOString() ?? null, estado: c.estado,
          comprobante: (c as unknown as Record<string, unknown>).comprobante as string | null,
        })),
      })),
      total,
    };
  }

  async detalle(id: string): Promise<FacturacionRow | null> {
    const r = await prisma.facturacion.findUnique({
      where: { id },
      include: {
        cuotas: { orderBy: { numero: "asc" } },
        solicitud: {
          select: {
            email: true,
            gessStand: { select: { standCode: true } },
            stands: { include: { gessStand: { select: { standCode: true } } } },
          },
        },
      },
    });
    if (!r) return null;
    return {
      id: r.id, solicitudId: r.solicitudId, tipo: r.tipo, estado: r.estado,
      montoTotal: Number(r.montoTotal), moneda: r.moneda,
      modoPago: (r as unknown as Record<string, unknown>).modoPago as string ?? "cuotas",
      standCode: r.solicitud.gessStand?.standCode ?? r.solicitud.stands[0]?.gessStand?.standCode ?? "—",
      correoSolicitante: r.solicitud.email,
      createdAt: r.createdAt.toISOString(),
      cuotas: r.cuotas.map(c => ({
        id: c.id, numero: c.numero, monto: Number(c.monto),
        fechaVencimiento: c.fechaVencimiento?.toISOString() ?? null, estado: c.estado,
        comprobante: (c as unknown as Record<string, unknown>).comprobante as string | null,
      })),
    };
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
      await prisma.solicitud.update({ where: { id: (await prisma.facturacion.findUnique({ where: { id: cuota.facturacionId }, select: { solicitudId: true } }))!.solicitudId }, data: { estado: ESTADOS_SOLICITUD.PAGADO } });
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
    if (cuota) {
      await prisma.facturacionCuota.delete({ where: { id: cuotaId } });
      await prisma.facturacionHistorial.create({
        data: { facturacionId: cuota.facturacionId, accion: "eliminar_cuota", detalle: `Cuota #${cuota.numero} eliminada`, createdBy },
      });
    }
  }
}

export const facturacionRepo = new FacturacionPrismaRepository();
