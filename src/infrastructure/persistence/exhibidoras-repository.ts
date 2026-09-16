import 'server-only';

import { prisma } from "@/lib/server/db";
import type { IExhibidorasRepository } from "@/domain/ports/exhibidoras-repository";
import type { ExhibidoraDTO } from "@/types/dto/exhibidoras/exhibidoras.dto";

export class ExhibidorasPrismaRepository implements IExhibidorasRepository {
  async listar(search?: string): Promise<ExhibidoraDTO[]> {
    const q = (search ?? "").trim().toUpperCase();
    const mapa = new Map<string, ExhibidoraDTO>();

    // 1. Solicitudes activas → usuario → empresa vinculada en user_role
    const solicitudes = await prisma.solicitud.findMany({
      where: { flgActivo: true },
      select: { userId: true },
    });
    const userIds = solicitudes.map(s => s.userId).filter(Boolean) as string[];
    if (userIds.length > 0) {
      const usuarios = await prisma.userRole.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, idEmpresa: true, nombreEmpresa: true },
      });
      for (const u of usuarios) {
        const id = u.idEmpresa?.trim();
        if (!id) continue;
        if (!mapa.has(id)) {
          mapa.set(id, { id_empresa: id, razon_social: u.nombreEmpresa ?? "" });
        }
      }
    }

    // 2. Stands GESS con empresa vinculada
    const gessStands = await prisma.gessStand.findMany({
      where: { empresa: { not: null } },
      select: { empresa: true, rawData: true },
    });
    for (const g of gessStands) {
      const raw = g.rawData as { id_empresa?: string; idEmpresa?: string } | null;
      const id = (raw?.id_empresa ?? raw?.idEmpresa ?? "").trim();
      if (!id) continue;
      const nombre = g.empresa?.trim() ?? "";
      const actual = mapa.get(id);
      if (actual && actual.razon_social) continue;
      mapa.set(id, { id_empresa: id, razon_social: nombre });
    }

    // 3. Reservas con empresaRef
    const reservas = await prisma.reserva.findMany({
      select: { empresaRef: true, datosFacturacion: true },
    });
    for (const r of reservas) {
      const id = r.empresaRef?.trim();
      if (!id) continue;
      const df = r.datosFacturacion as { razonSocial?: string; nombre?: string } | null;
      const nombre = df?.razonSocial ?? df?.nombre ?? "";
      const actual = mapa.get(id);
      if (actual && actual.razon_social) continue;
      mapa.set(id, { id_empresa: id, razon_social: nombre });
    }

    let lista = Array.from(mapa.values());
    if (q) {
      lista = lista.filter(e => e.razon_social.toUpperCase().includes(q) || e.id_empresa.includes(q));
    }
    return lista.sort((a, b) => a.razon_social.localeCompare(b.razon_social));
  }
}

export const exhibidorasRepo = new ExhibidorasPrismaRepository();
