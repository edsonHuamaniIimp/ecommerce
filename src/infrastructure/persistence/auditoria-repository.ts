import "server-only";

import { prisma } from "@/lib/server/db";
import type { AuditoriaEvento, IAuditoriaRepository } from "@/domain/ports/auditoria-repository";

export class AuditoriaPrismaRepository implements IAuditoriaRepository {
  async registrar(evento: AuditoriaEvento): Promise<void> {
    await prisma.auditLog.create({
      data: {
        tipo: evento.tipo.slice(0, 30),
        entidad: evento.entidad?.slice(0, 100) ?? null,
        actor: evento.actor?.slice(0, 100) ?? null,
        mensaje: evento.mensaje,
        metadata: (evento.metadata ?? undefined) as never,
        ip: evento.ip?.slice(0, 45) ?? null,
        userAgent: evento.userAgent?.slice(0, 500) ?? null,
        metodo: evento.metodo?.slice(0, 10) ?? null,
        ruta: evento.ruta?.slice(0, 300) ?? null,
      },
    });
  }
}
